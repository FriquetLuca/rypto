import path from 'node:path';
import {
  joinRoute,
  removeLastSplitIndex,
  encodeRouteSegment,
} from '../../neutral/router/index.js';

export const filePathToRoute: (
  root: string,
  filePath: string,
  staticRoute?: boolean
) => string = (root: string, filePath: string, staticRoute?: boolean) =>
  joinRoute(
    removeLastSplitIndex(path.relative(root, filePath).split(path.sep)).map(
      (v) => encodeRouteSegment(v, staticRoute)
    )
  );
