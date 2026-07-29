import { createDatabasePool } from '../src/database/index.js';

const tenantId = 'ten_mangamma01';
const outletId = 'out_hyderabad01';

const seed = async (): Promise<void> => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Development seed is prohibited in production');
  }

  const pool = createDatabasePool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    await client.query(
      `
        INSERT INTO tenants (
          id,
          legal_name,
          display_name,
          status
        )
        VALUES (
          $1,
          'Lakshya Foodways',
          'Mangamma Ruchulu',
          'active'
        )
        ON CONFLICT (id) DO NOTHING
      `,
      [tenantId],
    );
    await client.query(
      `
        INSERT INTO outlets (
          id,
          tenant_id,
          name,
          latitude,
          longitude,
          service_radius_km,
          status
        )
        VALUES (
          $1,
          $2,
          'Mangamma Ruchulu Cloud Kitchen',
          17.385044,
          78.486671,
          8,
          'open'
        )
        ON CONFLICT (id) DO NOTHING
      `,
      [outletId, tenantId],
    );
    await client.query(
      `
        INSERT INTO brands (id, tenant_id, name, status)
        VALUES ('brd_mangamma01', $1, 'Mangamma Ruchulu', 'active')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO menu_categories (
          id, tenant_id, brand_id, name, display_order, status
        )
        VALUES (
          'cat_home_meals01', $1, 'brd_mangamma01', 'Home-style meals', 1, 'active'
        )
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO kitchen_stations (
          id, tenant_id, outlet_id, name, capacity_units, status
        )
        VALUES ('stn_main_line01', $1, $2, 'Main line', 4, 'active')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO menu_items (
          id,
          tenant_id,
          brand_id,
          category_id,
          name,
          description,
          dietary_type,
          allergen_facts,
          base_price_paise,
          status
        )
        VALUES (
          'itm_home_thali01',
          $1,
          'brd_mangamma01',
          'cat_home_meals01',
          'Mangamma home-style thali',
          'A balanced rotating home-style meal',
          'vegetarian',
          '["milk"]',
          29900,
          'active'
        )
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO recipe_versions (
          id,
          tenant_id,
          item_id,
          station_id,
          version,
          expected_duration_seconds,
          instructions,
          status,
          published_at
        )
        VALUES (
          'rcp_home_thali01',
          $1,
          'itm_home_thali01',
          'stn_main_line01',
          1,
          900,
          'Prepare fresh, complete the quality check and seal before dispatch.',
          'published',
          now()
        )
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO item_availability (
          tenant_id, outlet_id, item_id, status, available_quantity
        )
        VALUES ($1, $2, 'itm_home_thali01', 'available', 100)
        ON CONFLICT (tenant_id, outlet_id, item_id)
        DO UPDATE SET
          status = EXCLUDED.status,
          available_quantity = EXCLUDED.available_quantity,
          version = item_availability.version + 1,
          updated_at = now();

        INSERT INTO commerce_pricing_policies (
          id,
          tenant_id,
          outlet_id,
          name,
          tax_rate_bps,
          delivery_fee_paise,
          packaging_fee_paise,
          calculation_version,
          effective_from,
          status
        )
        VALUES (
          'prc_local_food01',
          $1,
          $2,
          'Local development pricing',
          500,
          3000,
          1000,
          'local-food-pricing-v1',
          now() - interval '1 day',
          'active'
        )
        ON CONFLICT (id) DO NOTHING
      `,
      [tenantId, outletId],
    );
    await client.query('COMMIT');
    process.stdout.write(`Seeded ${tenantId}/${outletId}\n`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

seed().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Development seed failed: ${message}\n`);
  process.exitCode = 1;
});
