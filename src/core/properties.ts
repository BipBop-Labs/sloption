import { z } from "zod";

export const propertyTypeSchema = z.enum([
  "text",
  "number",
  "date",
  "select",
  "multiSelect",
  "people",
]);

export const propertySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(1).max(100),
    type: propertyTypeSchema,
    options: z.array(
      z
        .object({
          id: z.string().min(1),
          label: z.string().trim().min(1).max(100),
        })
        .strict(),
    ),
  })
  .strict();

export type Property = z.infer<typeof propertySchema>;
export type PropertyValue = string | number | string[] | null;

/** All fields are nullable. Selection and people values must reference existing IDs. */
export function parsePropertyValue(
  property: Property,
  value: unknown,
  assignableIds: ReadonlySet<string>,
): PropertyValue {
  if (value === null) return null;
  switch (property.type) {
    case "text":
      return z.string().max(100_000).parse(value);
    case "number":
      return z.number().finite().parse(value);
    case "date":
      return z.iso.date().parse(value);
    case "select": {
      const optionIds = new Set(property.options.map((option) => option.id));
      return z
        .string()
        .refine((id) => optionIds.has(id), "Unknown option")
        .parse(value);
    }
    case "multiSelect":
    case "people": {
      const validIds =
        property.type === "people"
          ? assignableIds
          : new Set(property.options.map((option) => option.id));
      return z
        .array(z.string().refine((id) => validIds.has(id), "Unknown reference"))
        .refine(
          (ids) => new Set(ids).size === ids.length,
          "Duplicate reference",
        )
        .parse(value);
    }
  }
}

/** Removing an option clears only that reference; other selections remain intact. */
export function removeOptionReference(
  value: PropertyValue,
  optionId: string,
): PropertyValue {
  if (Array.isArray(value)) return value.filter((id) => id !== optionId);
  return value === optionId ? null : value;
}
