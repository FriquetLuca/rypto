export const removeFilePathExt: (filePath: string) => string = (
  filePath: string
) => filePath.replace(/\.(ssr|ssg|csr|server)\.[tj]sx?$/, '');
