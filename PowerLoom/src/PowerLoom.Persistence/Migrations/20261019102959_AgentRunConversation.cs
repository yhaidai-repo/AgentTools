using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PowerLoom.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AgentRunConversation : Migration
    {
        // A run that ends without success is continued by the task's next run (user decision 2026-10-19): each run keeps
        // its provider conversation id and the run it continued; "Start over" on a task asks for a fresh conversation.
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "start_over",
                table: "local_item",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<long>(
                name: "continues_run_id",
                table: "agent_run",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "conversation_id",
                table: "agent_run",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "agent_run_item_idx",
                table: "agent_run",
                column: "item_id");

            migrationBuilder.AddForeignKey(
                name: "agent_run_continues_run_id_agent_run_id_fk",
                table: "agent_run",
                column: "continues_run_id",
                principalTable: "agent_run",
                principalColumn: "id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "agent_run_continues_run_id_agent_run_id_fk",
                table: "agent_run");

            migrationBuilder.DropIndex(
                name: "agent_run_item_idx",
                table: "agent_run");

            migrationBuilder.DropColumn(
                name: "start_over",
                table: "local_item");

            migrationBuilder.DropColumn(
                name: "continues_run_id",
                table: "agent_run");

            migrationBuilder.DropColumn(
                name: "conversation_id",
                table: "agent_run");
        }
    }
}
