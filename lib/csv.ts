/**
 * CSV parsing for the Flocknote export.
 *
 * Deliberately hand-rolled: the file is small, it arrives once, and the only
 * hard requirement is handling quoted fields containing commas (which every
 * export with an address column has).
 */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  // Strip a UTF-8 BOM, which Excel adds and which would otherwise become part
  // of the first header name.
  const input = text.replace(/^﻿/, "");

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (inQuotes) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  // Flush whatever the file ended on, unless it ended with a clean newline.
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((candidate) =>
    candidate.some((value) => value.trim() !== "")
  );
}

/**
 * Match a header row against the names various church tools use, so the
 * office does not have to rename columns before importing.
 */
const COLUMN_ALIASES: Record<string, string[]> = {
  firstName: ["first name", "firstname", "first", "given name"],
  lastName: ["last name", "lastname", "last", "surname", "family name"],
  fullName: ["name", "full name", "fullname", "display name"],
  phone: [
    "phone",
    "mobile",
    "cell",
    "cell phone",
    "mobile phone",
    "phone number",
    "mobile number",
    "text number",
  ],
  email: ["email", "e-mail", "email address", "primary email"],
  groups: ["groups", "group", "tags", "ministries", "notes group"],
};

export interface ColumnMap {
  firstName?: number;
  lastName?: number;
  fullName?: number;
  phone?: number;
  email?: number;
  groups?: number;
}

export function mapColumns(header: string[]): ColumnMap {
  const normalized = header.map((name) => name.trim().toLowerCase());
  const map: ColumnMap = {};

  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    const index = normalized.findIndex((name) => aliases.includes(name));
    if (index !== -1) map[field as keyof ColumnMap] = index;
  }

  return map;
}

export interface ParsedContact {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  groups: string[];
  rowNumber: number;
}

export function extractContacts(rows: string[][]): {
  contacts: ParsedContact[];
  columns: ColumnMap;
} {
  if (rows.length === 0) return { contacts: [], columns: {} };

  const [header, ...body] = rows;
  const columns = mapColumns(header);
  const contacts: ParsedContact[] = [];

  body.forEach((row, index) => {
    const read = (column?: number) =>
      column === undefined ? "" : (row[column] ?? "").trim();

    let firstName = read(columns.firstName);
    let lastName = read(columns.lastName);

    // Some exports have a single "Name" column instead of separate ones.
    if (!firstName && !lastName && columns.fullName !== undefined) {
      const parts = read(columns.fullName).split(/\s+/).filter(Boolean);
      firstName = parts[0] ?? "";
      lastName = parts.slice(1).join(" ");
    }

    contacts.push({
      firstName,
      lastName,
      phone: read(columns.phone),
      email: read(columns.email),
      groups: read(columns.groups)
        .split(/[;,|]/)
        .map((name) => name.trim())
        .filter(Boolean),
      // +2 accounts for the header row and 1-based numbering, so the number
      // matches what the office sees in their spreadsheet.
      rowNumber: index + 2,
    });
  });

  return { contacts, columns };
}
