"""Normalizes a `pg_dump --schema-only` so two databases can be diffed for what matters.

Drops comments, SET lines, ownership, the migration history tables and pg_dump's restrict token; sorts the column
lines inside every CREATE TABLE (column order is cosmetic). Usage: python -I normalize-schema-dump.py < dump.sql
"""
import re
import sys

NOISE = re.compile(r"^(--|SET |SELECT pg_catalog|\\restrict|\\unrestrict|ALTER .* OWNER TO)")
HISTORY = ("__EFMigrationsHistory", "__drizzle_migrations")


def is_noise(line):
    return not line.strip() or NOISE.match(line) or any(table in line for table in HISTORY)


def sorted_table(block):
    header, body, footer = block[0], block[1:-1], block[-1]
    columns = sorted(column.rstrip(",") for column in body)

    return [header] + [column + "," for column in columns[:-1]] + columns[-1:] + [footer]


def normalize(lines):
    output = []
    table = None
    keep = True

    for line in lines:
        if table is not None:
            table.append(line)

            if line.startswith(");"):
                output.extend(sorted_table(table) if keep else [])
                table = None

            continue

        if line.startswith("CREATE TABLE "):
            table = [line]
            keep = not is_noise(line)
        elif not is_noise(line):
            output.append(line)

    return output


print("\n".join(normalize(line.rstrip() for line in sys.stdin)))
