// Adds a picked file to a FormData in the shape the current platform needs.
//
// React Native's networking layer only understands a file part written as { uri, name, type }; a real Blob
// appended to a FormData is silently dropped by the native side and the request then fails with
// "Network Error" (seen on Android release builds: every photo upload in both apps failed this way while the
// same file posted from a PC with curl was accepted). On the web a real Blob/File is required instead.

const TYPES: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', gif: 'image/gif',
  mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/x-m4v', '3gp': 'video/3gpp',
  pdf: 'application/pdf',
};

function guessType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return TYPES[ext] ?? 'application/octet-stream';
}

function isReactNative(): boolean {
  return typeof navigator !== 'undefined' && (navigator as { product?: string }).product === 'ReactNative';
}

export async function appendFile(
  form: FormData,
  field: string,
  file: { uri: string; name: string; type?: string },
): Promise<void> {
  const type = file.type && file.type.includes('/') ? file.type : guessType(file.name);
  if (isReactNative()) {
    form.append(field, { uri: file.uri, name: file.name, type } as unknown as Blob);
    return;
  }
  const blob = await (await fetch(file.uri)).blob();
  form.append(field, blob, file.name);
}
