
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const cookies = request.headers.get("cookie") ?? "";

    const sessionCookie = cookies
      .split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith("one_space_session="));

    const token = sessionCookie?.slice("one_space_session=".length);

    if (token && /^[a-f0-9]{64}$/.test(token)) {
      const tokenHash = createHash("sha256")
        .update(token)
        .digest("hex");

      await prisma.userSession.updateMany({
        where: {
          tokenHash,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    }

    const response = Response.json({
      success: true,
      message: "Logged out successfully.",
    });

    response.headers.append(
      "Set-Cookie",
      `one_space_session=; HttpOnly; ${process.env.NODE_ENV === "production" ? "Secure; " : ""}SameSite=Lax; Path=/; Max-Age=0`
    );

    return response;
  } catch (error) {
    console.error("LOGOUT ERROR:", error);

    return Response.json(
      { success: false, message: "Logout could not be completed." },
      { status: 500 }
    );
  }
}
