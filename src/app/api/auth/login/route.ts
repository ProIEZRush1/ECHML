import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Correo y contrasena son requeridos" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Credenciales invalidas" },
        { status: 401 }
      );
    }

    const passwordValid = await compare(password, user.passwordHash);

    if (!passwordValid) {
      return NextResponse.json(
        { error: "Credenciales invalidas" },
        { status: 401 }
      );
    }

    await createSession(user.id, user.role);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Error interno del servidor", detail: message },
      { status: 500 }
    );
  }
}
