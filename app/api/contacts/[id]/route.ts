import { db } from "@/lib/db";
import { fail, handle, ok, readBody } from "@/lib/api-server";
import { ContactInput } from "@/lib/applications/schema";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const input = await readBody(req, ContactInput);
  if (!(await db.contact.findUnique({ where: { id } }))) return fail("Contact not found", 404);
  return ok(await db.contact.update({ where: { id }, data: input }));
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  if (!(await db.contact.findUnique({ where: { id } }))) return fail("Contact not found", 404);
  await db.contact.delete({ where: { id } });
  return ok({ deleted: true });
});
