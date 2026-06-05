export function title(text: string) {
  return { title: [{ text: { content: text.slice(0, 2000) } }] };
}

export function richText(text: string) {
  return { rich_text: [{ text: { content: text.slice(0, 2000) } }] };
}

export function number(value: number) {
  return { number: value };
}

export function checkbox(value: boolean) {
  return { checkbox: value };
}

export function date(value: string) {
  return { date: { start: value } };
}

export function select(name: string) {
  return { select: { name } };
}

export function status(name: string) {
  return { status: { name } };
}

export function url(value?: string) {
  return value ? { url: value } : { url: null };
}

export function relation(pageId: string) {
  return { relation: [{ id: pageId }] };
}

export function plainText(property: any): string {
  if (property?.type === "title") return property.title.map((item: any) => item.plain_text).join("");
  if (property?.type === "rich_text") return property.rich_text.map((item: any) => item.plain_text).join("");
  return "";
}

export function numeric(property: any): number {
  if (property?.type === "number") return property.number ?? 0;
  if (property?.type === "formula" && property.formula.type === "number") return property.formula.number ?? 0;
  return 0;
}

export function bool(property: any): boolean {
  return property?.type === "checkbox" ? property.checkbox : false;
}

export function selected(property: any): string {
  if (property?.type === "select") return property.select?.name ?? "";
  if (property?.type === "status") return property.status?.name ?? "";
  return "";
}

export function pageDate(property: any): string {
  return property?.type === "date" ? property.date?.start ?? "" : "";
}

