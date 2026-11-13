create table public.orders (
  id uuid primary key,
  request_id uuid not null unique,
  status text not null check (status in ('awaiting_payment', 'paid', 'failed', 'expired', 'cancelled')),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  customer jsonb not null,
  address jsonb not null,
  delivery text not null check (delivery in ('standard', 'express')),
  delivery_label text not null check (delivery_label in ('Standard delivery', 'Express delivery')),
  currency text not null check (currency = 'USD'),
  subtotal_minor bigint not null check (subtotal_minor >= 0),
  shipping_minor bigint not null check (shipping_minor >= 0),
  total_minor bigint not null check (total_minor = subtotal_minor + shipping_minor),
  mock_mode boolean not null
);

create table public.order_lines (
  order_id uuid not null references public.orders(id) on delete restrict,
  position integer not null check (position >= 0),
  product_id integer not null,
  slug text not null,
  name text not null,
  image text not null,
  size text not null,
  color text not null,
  quantity integer not null check (quantity > 0),
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  primary key (order_id, position)
);

create table public.payment_attempts (
  order_id uuid primary key references public.orders(id) on delete restrict,
  status text not null check (status in ('pending', 'paid', 'failed', 'expired')),
  qr_data_url text not null,
  expires_at timestamptz not null,
  provider_reference text not null unique,
  qr_payload text not null,
  md5 text not null,
  transaction_hash text unique
);

create index order_lines_order_id_idx on public.order_lines(order_id, position);

alter table public.orders enable row level security;
alter table public.order_lines enable row level security;
alter table public.payment_attempts enable row level security;

revoke all on public.orders, public.order_lines, public.payment_attempts from anon, authenticated;

create function public.order_snapshot(target_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', orders.id,
    'requestId', orders.request_id,
    'status', orders.status,
    'createdAt', orders.created_at,
    'updatedAt', orders.updated_at,
    'customer', orders.customer,
    'address', orders.address,
    'delivery', orders.delivery,
    'deliveryLabel', orders.delivery_label,
    'currency', orders.currency,
    'subtotalMinor', orders.subtotal_minor,
    'shippingMinor', orders.shipping_minor,
    'totalMinor', orders.total_minor,
    'mockMode', orders.mock_mode,
    'lines', coalesce((select jsonb_agg(jsonb_build_object(
      'productId', lines.product_id, 'slug', lines.slug, 'name', lines.name,
      'image', lines.image, 'size', lines.size, 'color', lines.color,
      'quantity', lines.quantity, 'unitPriceMinor', lines.unit_price_minor
    ) order by lines.position) from public.order_lines lines where lines.order_id = orders.id), '[]'::jsonb),
    'payment', jsonb_build_object(
      'status', payment_attempts.status, 'qrDataUrl', payment_attempts.qr_data_url,
      'expiresAt', payment_attempts.expires_at, 'providerReference', payment_attempts.provider_reference,
      'qrPayload', payment_attempts.qr_payload, 'md5', payment_attempts.md5,
      'transactionHash', payment_attempts.transaction_hash
    )
  )
  from public.orders
  join public.payment_attempts on payment_attempts.order_id = orders.id
  where orders.id = target_id
$$;

create function public.create_order(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid := (payload->>'id')::uuid;
  existing_id uuid;
  line jsonb;
  line_position integer := 0;
begin
  select id into existing_id from public.orders where request_id = (payload->>'requestId')::uuid;
  if existing_id is not null then return public.order_snapshot(existing_id); end if;

  insert into public.orders (
    id, request_id, status, created_at, updated_at, customer, address, delivery,
    delivery_label, currency, subtotal_minor, shipping_minor, total_minor, mock_mode
  ) values (
    target_id, (payload->>'requestId')::uuid, payload->>'status', (payload->>'createdAt')::timestamptz,
    (payload->>'updatedAt')::timestamptz, payload->'customer', payload->'address', payload->>'delivery',
    payload->>'deliveryLabel', payload->>'currency', (payload->>'subtotalMinor')::bigint,
    (payload->>'shippingMinor')::bigint, (payload->>'totalMinor')::bigint, (payload->>'mockMode')::boolean
  );

  for line in select value from jsonb_array_elements(payload->'lines') loop
    insert into public.order_lines (order_id, position, product_id, slug, name, image, size, color, quantity, unit_price_minor)
    values (target_id, line_position, (line->>'productId')::integer, line->>'slug', line->>'name',
      line->>'image', line->>'size', line->>'color', (line->>'quantity')::integer, (line->>'unitPriceMinor')::bigint);
    line_position := line_position + 1;
  end loop;

  insert into public.payment_attempts (
    order_id, status, qr_data_url, expires_at, provider_reference, qr_payload, md5, transaction_hash
  ) values (
    target_id, payload->'payment'->>'status', payload->'payment'->>'qrDataUrl',
    (payload->'payment'->>'expiresAt')::timestamptz, payload->'payment'->>'providerReference',
    payload->'payment'->>'qrPayload', payload->'payment'->>'md5', payload->'payment'->>'transactionHash'
  );

  return public.order_snapshot(target_id);
exception when unique_violation then
  select id into existing_id from public.orders where request_id = (payload->>'requestId')::uuid;
  if existing_id is not null then return public.order_snapshot(existing_id); end if;
  raise;
end;
$$;

create function public.get_order(target_id uuid)
returns jsonb language sql stable security definer set search_path = public
as $$ select public.order_snapshot(target_id) $$;

create function public.get_order_by_request_id(target_request_id uuid)
returns jsonb language sql stable security definer set search_path = public
as $$ select public.order_snapshot(id) from public.orders where request_id = target_request_id $$;

create function public.get_order_by_provider_reference(target_reference text)
returns jsonb language sql stable security definer set search_path = public
as $$ select public.order_snapshot(order_id) from public.payment_attempts where provider_reference = target_reference $$;

create function public.mark_order_paid(target_id uuid, target_hash text, changed_at timestamptz)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare current_hash text;
begin
  select transaction_hash into current_hash from public.payment_attempts where order_id = target_id for update;
  if not found then return false; end if;
  if current_hash is not null then return current_hash = target_hash; end if;
  update public.orders set status = 'paid', updated_at = changed_at where id = target_id and status = 'awaiting_payment';
  if not found then return false; end if;
  update public.payment_attempts set status = 'paid', transaction_hash = target_hash where order_id = target_id and status = 'pending';
  if not found then raise exception 'Payment status does not allow this transition'; end if;
  return true;
end;
$$;

create function public.mark_order_unpaid(target_id uuid, target_status text, changed_at timestamptz)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  if target_status not in ('failed', 'expired') then raise exception 'Invalid payment status'; end if;
  if exists(select 1 from public.orders where id = target_id and status = 'paid') then raise exception 'Cannot change a paid order'; end if;
  update public.orders set status = target_status, updated_at = changed_at where id = target_id and status = 'awaiting_payment';
  if not found then return exists(select 1 from public.orders where id = target_id and status = target_status); end if;
  update public.payment_attempts set status = target_status where order_id = target_id and status = 'pending';
  if not found then raise exception 'Payment status does not allow this transition'; end if;
  return true;
end;
$$;

revoke all on function public.order_snapshot(uuid), public.create_order(jsonb), public.get_order(uuid),
  public.get_order_by_request_id(uuid), public.get_order_by_provider_reference(text),
  public.mark_order_paid(uuid, text, timestamptz), public.mark_order_unpaid(uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.order_snapshot(uuid), public.create_order(jsonb), public.get_order(uuid),
  public.get_order_by_request_id(uuid), public.get_order_by_provider_reference(text),
  public.mark_order_paid(uuid, text, timestamptz), public.mark_order_unpaid(uuid, text, timestamptz)
  to service_role;
