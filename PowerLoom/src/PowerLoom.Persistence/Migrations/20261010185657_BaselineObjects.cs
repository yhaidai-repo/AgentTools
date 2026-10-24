using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PowerLoom.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class BaselineObjects : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // What EF can't model and drizzle created: one task per PBI and key (an expression index), and the
            // trigger that fills local_item.vault from the task's PBI.
            migrationBuilder.Sql("CREATE UNIQUE INDEX local_item_pbi_key_uq ON local_item (pbi_id, (data ->> 'key')) WHERE (data ->> 'key') IS NOT NULL");
            migrationBuilder.Sql("""
                CREATE FUNCTION local_item_vault_of_pbi() RETURNS trigger
                    LANGUAGE plpgsql
                    AS $$
                BEGIN
                  IF NEW.pbi_id IS NOT NULL THEN
                    SELECT vault INTO NEW.vault FROM work_item WHERE ado_id = NEW.pbi_id;
                  END IF;
                  RETURN NEW;
                END;
                $$
                """);
            migrationBuilder.Sql("CREATE TRIGGER local_item_vault_of_pbi BEFORE INSERT ON local_item FOR EACH ROW EXECUTE FUNCTION local_item_vault_of_pbi()");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP TRIGGER local_item_vault_of_pbi ON local_item");
            migrationBuilder.Sql("DROP FUNCTION local_item_vault_of_pbi()");
            migrationBuilder.Sql("DROP INDEX local_item_pbi_key_uq");
        }
    }
}
