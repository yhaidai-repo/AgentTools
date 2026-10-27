using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PowerLoom.Persistence.Migrations;

[DbContext(typeof(PowerLoomDbContext))]
[Migration("20261026150000_ItemIdReservations")]
public sealed class ItemIdReservations : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            CREATE TABLE item_id_counter (stem text PRIMARY KEY, last_value bigint NOT NULL);
            INSERT INTO item_id_counter (stem, last_value)
            SELECT regexp_replace(id, '[0-9]+$', ''), max(substring(id from '[0-9]+$')::bigint)
            FROM local_item WHERE id ~ '[0-9]+$' GROUP BY 1;

            CREATE FUNCTION reserve_item_id(wanted_stem text) RETURNS text LANGUAGE plpgsql AS $$
            DECLARE allocated bigint;
            BEGIN
                IF wanted_stem IS NULL OR wanted_stem = '' THEN RAISE EXCEPTION 'An item id stem is required'; END IF;
                INSERT INTO item_id_counter AS counter (stem, last_value) VALUES (wanted_stem, 1)
                ON CONFLICT (stem) DO UPDATE SET last_value = counter.last_value + 1
                RETURNING last_value INTO allocated;
                RETURN wanted_stem || lpad(allocated::text, greatest(3, length(allocated::text)), '0');
            END $$;

            -- Imports and explicit ids advance the same high-water mark; deleting items never lowers it.
            CREATE FUNCTION remember_item_id() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
                IF NEW.id ~ '[0-9]+$' THEN
                    INSERT INTO item_id_counter AS counter (stem, last_value)
                    VALUES (regexp_replace(NEW.id, '[0-9]+$', ''), substring(NEW.id from '[0-9]+$')::bigint)
                    ON CONFLICT (stem) DO UPDATE SET last_value = excluded.last_value
                    WHERE counter.last_value < excluded.last_value;
                END IF;
                RETURN NEW;
            END $$;
            CREATE TRIGGER local_item_remember_id AFTER INSERT OR UPDATE OF id ON local_item
            FOR EACH ROW EXECUTE FUNCTION remember_item_id();
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DROP TRIGGER local_item_remember_id ON local_item;
            DROP FUNCTION remember_item_id();
            DROP FUNCTION reserve_item_id(text);
            DROP TABLE item_id_counter;
            """);
    }
}
