export type RenderMode = 'csr' | 'ssr' | 'ssg';
export const fileRenderMode: (filePath: string) => RenderMode = (
  filePath: string
) => (/\.(ssr|ssg|csr)\.[tj]sx?$/.exec(filePath)?.[1] as RenderMode) ?? 'ssr';
