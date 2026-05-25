import { NextResponse } from "next/server";
import { Pool } from "pg";

// TEMPORARY debug route — delete after fixing the DB connection issue
export async function GET() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    return NextResponse.json({ error: "DATABASE_URL not set" }, { status: 500 });
  }

  const masked = connectionString.replace(/:([^@]+)@/, ":***@");

  try {
    const pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
    });

    const client = await pool.connect();
    const result = await client.query("SELECT current_user, version()");
    client.release();
    await pool.end();

    return NextResponse.json({
      ok: true,
      url: masked,
      user: result.rows[0].current_user,
      version: result.rows[0].version,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        url: masked,
        error: err.message,
        code: err.code,
      },
      { status: 500 }
    );
  }
}
