/** Extracts an uploaded file field from a multipart/form-data body as a Buffer. */
export async function fileFromFormData(formData: FormData, field: string): Promise<Buffer | null> {
  const value = formData.get(field);
  if (!value || typeof value === "string") return null;
  const arrayBuffer = await value.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
