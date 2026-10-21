# [rypto](README.md)/node

## Classes

### FileCache

Defined in: [rypto/src/node/fs/fileCache.ts:25](https://github.com/FriquetLuca/rypto/blob/master/rypto/src/node/fs/fileCache.ts#L25)

#### Constructors

##### Constructor

```ts
new FileCache(maxBytes?, maxEntryBytes?): FileCache;
```

Defined in: [rypto/src/node/fs/fileCache.ts:30](https://github.com/FriquetLuca/rypto/blob/master/rypto/src/node/fs/fileCache.ts#L30)

###### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `maxBytes?` | `number` | `67108864` |
| `maxEntryBytes?` | `number` | `2097152` |

###### Returns

[`FileCache`](#filecache)

#### Accessors

##### stats

###### Get Signature

```ts
get stats(): CacheStats;
```

Defined in: [rypto/src/node/fs/fileCache.ts:107](https://github.com/FriquetLuca/rypto/blob/master/rypto/src/node/fs/fileCache.ts#L107)

###### Returns

[`CacheStats`](#cachestats)

#### Methods

##### clear()

```ts
clear(): void;
```

Defined in: [rypto/src/node/fs/fileCache.ts:103](https://github.com/FriquetLuca/rypto/blob/master/rypto/src/node/fs/fileCache.ts#L103)

###### Returns

`void`

##### get()

###### Call Signature

```ts
get(filePath, options): Buffer<ArrayBufferLike> | undefined;
```

Defined in: [rypto/src/node/fs/fileCache.ts:65](https://github.com/FriquetLuca/rypto/blob/master/rypto/src/node/fs/fileCache.ts#L65)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `filePath` | `string` |
| `options` | [`ReadOptions`](#readoptions) |

###### Returns

`Buffer`\<`ArrayBufferLike`\> \| `undefined`

###### Call Signature

```ts
get(filePath, options): string | undefined;
```

Defined in: [rypto/src/node/fs/fileCache.ts:66](https://github.com/FriquetLuca/rypto/blob/master/rypto/src/node/fs/fileCache.ts#L66)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `filePath` | `string` |
| `options` | [`ReadTextOptions`](#readtextoptions) |

###### Returns

`string` \| `undefined`

##### getAsync()

###### Call Signature

```ts
getAsync(filePath, options): Promise<Buffer<ArrayBufferLike> | undefined>;
```

Defined in: [rypto/src/node/fs/fileCache.ts:81](https://github.com/FriquetLuca/rypto/blob/master/rypto/src/node/fs/fileCache.ts#L81)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `filePath` | `string` |
| `options` | [`ReadOptions`](#readoptions) |

###### Returns

`Promise`\<`Buffer`\<`ArrayBufferLike`\> \| `undefined`\>

###### Call Signature

```ts
getAsync(filePath, options): Promise<string | undefined>;
```

Defined in: [rypto/src/node/fs/fileCache.ts:85](https://github.com/FriquetLuca/rypto/blob/master/rypto/src/node/fs/fileCache.ts#L85)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `filePath` | `string` |
| `options` | [`ReadTextOptions`](#readtextoptions) |

###### Returns

`Promise`\<`string` \| `undefined`\>

## Interfaces

### CacheStats

Defined in: [rypto/src/node/fs/fileCache.ts:19](https://github.com/FriquetLuca/rypto/blob/master/rypto/src/node/fs/fileCache.ts#L19)

#### Properties

| Property | Type | Defined in |
| ------ | ------ | ------ |
| <a id="property-bytes"></a> `bytes` | `number` | [rypto/src/node/fs/fileCache.ts:21](https://github.com/FriquetLuca/rypto/blob/master/rypto/src/node/fs/fileCache.ts#L21) |
| <a id="property-entries"></a> `entries` | `number` | [rypto/src/node/fs/fileCache.ts:20](https://github.com/FriquetLuca/rypto/blob/master/rypto/src/node/fs/fileCache.ts#L20) |
| <a id="property-maxbytes"></a> `maxBytes` | `number` | [rypto/src/node/fs/fileCache.ts:22](https://github.com/FriquetLuca/rypto/blob/master/rypto/src/node/fs/fileCache.ts#L22) |

***

### ReadOptions

Defined in: [rypto/src/node/fs/fileCache.ts:10](https://github.com/FriquetLuca/rypto/blob/master/rypto/src/node/fs/fileCache.ts#L10)

#### Extended by

- [`ReadTextOptions`](#readtextoptions)

#### Properties

| Property | Type | Defined in |
| ------ | ------ | ------ |
| <a id="property-flag"></a> `flag?` | `OpenMode` | [rypto/src/node/fs/fileCache.ts:12](https://github.com/FriquetLuca/rypto/blob/master/rypto/src/node/fs/fileCache.ts#L12) |
| <a id="property-signal"></a> `signal?` | `AbortSignal` | [rypto/src/node/fs/fileCache.ts:11](https://github.com/FriquetLuca/rypto/blob/master/rypto/src/node/fs/fileCache.ts#L11) |

***

### ReadTextOptions

Defined in: [rypto/src/node/fs/fileCache.ts:15](https://github.com/FriquetLuca/rypto/blob/master/rypto/src/node/fs/fileCache.ts#L15)

#### Extends

- [`ReadOptions`](#readoptions)

#### Properties

| Property | Type | Inherited from | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="property-encoding"></a> `encoding` | `BufferEncoding` | - | [rypto/src/node/fs/fileCache.ts:16](https://github.com/FriquetLuca/rypto/blob/master/rypto/src/node/fs/fileCache.ts#L16) |
| <a id="property-flag-1"></a> `flag?` | `OpenMode` | [`ReadOptions`](#readoptions).[`flag`](#property-flag) | [rypto/src/node/fs/fileCache.ts:12](https://github.com/FriquetLuca/rypto/blob/master/rypto/src/node/fs/fileCache.ts#L12) |
| <a id="property-signal-1"></a> `signal?` | `AbortSignal` | [`ReadOptions`](#readoptions).[`signal`](#property-signal) | [rypto/src/node/fs/fileCache.ts:11](https://github.com/FriquetLuca/rypto/blob/master/rypto/src/node/fs/fileCache.ts#L11) |

## Type Aliases

### RenderMode

```ts
type RenderMode = "csr" | "ssr" | "ssg";
```

Defined in: [rypto/src/node/router/fileRenderMode.ts:1](https://github.com/FriquetLuca/rypto/blob/master/rypto/src/node/router/fileRenderMode.ts#L1)

## Variables

### filePathToRoute

```ts
const filePathToRoute: (root, filePath, staticRoute?) => string;
```

Defined in: [rypto/src/node/router/filePathToRoute.ts:8](https://github.com/FriquetLuca/rypto/blob/master/rypto/src/node/router/filePathToRoute.ts#L8)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `root` | `string` |
| `filePath` | `string` |
| `staticRoute?` | `boolean` |

#### Returns

`string`

***

### fileRenderMode

```ts
const fileRenderMode: (filePath) => RenderMode;
```

Defined in: [rypto/src/node/router/fileRenderMode.ts:2](https://github.com/FriquetLuca/rypto/blob/master/rypto/src/node/router/fileRenderMode.ts#L2)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `filePath` | `string` |

#### Returns

[`RenderMode`](#rendermode)

***

### isServerFile

```ts
const isServerFile: (filePath) => boolean;
```

Defined in: [rypto/src/node/router/isServerFile.ts:1](https://github.com/FriquetLuca/rypto/blob/master/rypto/src/node/router/isServerFile.ts#L1)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `filePath` | `string` |

#### Returns

`boolean`

***

### removeFilePathExt

```ts
const removeFilePathExt: (filePath) => string;
```

Defined in: [rypto/src/node/router/removeFilePathExt.ts:1](https://github.com/FriquetLuca/rypto/blob/master/rypto/src/node/router/removeFilePathExt.ts#L1)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `filePath` | `string` |

#### Returns

`string`

## Functions

### decodeURIPath()

```ts
function decodeURIPath(encodedURI): string | undefined;
```

Defined in: [rypto/src/node/uri/decodeURIPath.ts:1](https://github.com/FriquetLuca/rypto/blob/master/rypto/src/node/uri/decodeURIPath.ts#L1)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `encodedURI` | `string` |

#### Returns

`string` \| `undefined`

***

### discardDotsSegmentsURL()

```ts
function discardDotsSegmentsURL(url): string;
```

Defined in: [rypto/src/node/url/discardDotsSegmentsURL.ts:1](https://github.com/FriquetLuca/rypto/blob/master/rypto/src/node/url/discardDotsSegmentsURL.ts#L1)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `url` | `string` |

#### Returns

`string`

***

### encodeURIPath()

```ts
function encodeURIPath(filePath): string | undefined;
```

Defined in: [rypto/src/node/uri/encodeURIPath.ts:3](https://github.com/FriquetLuca/rypto/blob/master/rypto/src/node/uri/encodeURIPath.ts#L3)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `filePath` | `string` |

#### Returns

`string` \| `undefined`

***

### resolveDotsSegmentsURL()

```ts
function resolveDotsSegmentsURL(url): string;
```

Defined in: [rypto/src/node/url/resolveDotsSegmentsURL.ts:1](https://github.com/FriquetLuca/rypto/blob/master/rypto/src/node/url/resolveDotsSegmentsURL.ts#L1)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `url` | `string` |

#### Returns

`string`

***

### resolveRelativeURL()

```ts
function resolveRelativeURL(root, url): string | undefined;
```

Defined in: [rypto/src/node/url/resolveRelativeURL.ts:3](https://github.com/FriquetLuca/rypto/blob/master/rypto/src/node/url/resolveRelativeURL.ts#L3)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `root` | `string` |
| `url` | `string` |

#### Returns

`string` \| `undefined`

***

### walkDirectories()

```ts
function walkDirectories(dirPath): Promise<string[]>;
```

Defined in: [rypto/src/node/fs/walkDirectories.ts:5](https://github.com/FriquetLuca/rypto/blob/master/rypto/src/node/fs/walkDirectories.ts#L5)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `dirPath` | `string` |

#### Returns

`Promise`\<`string`[]\>

***

### walkDirectoriesSync()

```ts
function walkDirectoriesSync(dirPath, acc?): string[];
```

Defined in: [rypto/src/node/fs/walkDirectories.ts:20](https://github.com/FriquetLuca/rypto/blob/master/rypto/src/node/fs/walkDirectories.ts#L20)

#### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `dirPath` | `string` | `undefined` |
| `acc?` | `string`[] | `[]` |

#### Returns

`string`[]

***

### walkDirectory()

```ts
function walkDirectory(dirPath): Promise<string[]>;
```

Defined in: [rypto/src/node/fs/walkDirectory.ts:5](https://github.com/FriquetLuca/rypto/blob/master/rypto/src/node/fs/walkDirectory.ts#L5)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `dirPath` | `string` |

#### Returns

`Promise`\<`string`[]\>

***

### walkDirectorySync()

```ts
function walkDirectorySync(dirPath, acc?): string[];
```

Defined in: [rypto/src/node/fs/walkDirectory.ts:28](https://github.com/FriquetLuca/rypto/blob/master/rypto/src/node/fs/walkDirectory.ts#L28)

#### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `dirPath` | `string` | `undefined` |
| `acc?` | `string`[] | `[]` |

#### Returns

`string`[]

***

### walkFiles()

```ts
function walkFiles(dirPath): Promise<string[]>;
```

Defined in: [rypto/src/node/fs/walkFiles.ts:5](https://github.com/FriquetLuca/rypto/blob/master/rypto/src/node/fs/walkFiles.ts#L5)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `dirPath` | `string` |

#### Returns

`Promise`\<`string`[]\>

***

### walkFilesSync()

```ts
function walkFilesSync(dirPath, acc?): string[];
```

Defined in: [rypto/src/node/fs/walkFiles.ts:28](https://github.com/FriquetLuca/rypto/blob/master/rypto/src/node/fs/walkFiles.ts#L28)

#### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `dirPath` | `string` | `undefined` |
| `acc?` | `string`[] | `[]` |

#### Returns

`string`[]
