import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/sign-in",
    error: "/sign-in",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      credentials: {
        email: { type: "email" },
        password: { type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const rows = await sql<{ id: string; email: string; name: string | null; image: string | null; password_hash: string | null }[]>`
          SELECT id, email, name, image, password_hash FROM users WHERE email = ${credentials.email as string}
        `;
        const user = rows[0];
        if (!user || !user.password_hash) return null;
        const ok = await bcrypt.compare(credentials.password as string, user.password_hash);
        if (!ok) return null;
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (account && (user || profile)) {
        if (account.provider === "google") {
          const email = (user?.email ?? (profile as { email?: string })?.email) as string;
          const name = (user?.name ?? (profile as { name?: string })?.name) as string | null;
          const image = (user?.image ?? (profile as { picture?: string })?.picture) as string | null;

          const existing = await sql<{ id: string }[]>`SELECT id FROM users WHERE email = ${email}`;
          if (existing[0]) {
            token.id = existing[0].id;
            await sql`UPDATE users SET name = COALESCE(name, ${name}), image = COALESCE(image, ${image}) WHERE id = ${existing[0].id}`;
          } else {
            const id = crypto.randomUUID();
            await sql`INSERT INTO users (id, email, name, image) VALUES (${id}, ${email}, ${name}, ${image})`;
            token.id = id;
          }
        } else {
          token.id = user.id as string;
        }
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      return session;
    },
  },
});
