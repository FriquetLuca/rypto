export const isServerFile: (filePath: string) => boolean = (filePath: string) =>
  /\.server\.[tj]sx?$/.exec(filePath) != null;
