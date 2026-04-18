import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

const DOWNLOADS_FOLDER_NAME = 'downloads';

const trimSlashes = (value) => String(value || '').replace(/^\/+|\/+$/g, '');

const resolveAbsoluteUrl = (baseUrl, endpointPath) => {
  const normalizedBaseUrl = String(baseUrl || '').trim();
  const normalizedEndpoint = String(endpointPath || '').trim();

  if (!normalizedBaseUrl) {
    throw new Error('Configura la URL del backend antes de descargar archivos.');
  }

  if (!normalizedEndpoint) {
    throw new Error('No se definió la ruta del archivo para descargar.');
  }

  if (/^https?:\/\//i.test(normalizedEndpoint)) {
    return normalizedEndpoint;
  }

  if (normalizedBaseUrl.endsWith('/')) {
    return `${normalizedBaseUrl}${trimSlashes(normalizedEndpoint)}`;
  }

  return `${normalizedBaseUrl}/${trimSlashes(normalizedEndpoint)}`;
};

const getSafeFilename = (filename) => {
  const normalized = String(filename || '').trim();
  if (!normalized) {
    return `archivo_${Date.now()}.csv`;
  }

  return normalized.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
};

const ensureDownloadDirectory = async () => {
  if (!FileSystem.documentDirectory) {
    throw new Error('No hay almacenamiento persistente disponible en este dispositivo.');
  }

  const dirPath = `${FileSystem.documentDirectory}${DOWNLOADS_FOLDER_NAME}/`;
  await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
  return dirPath;
};

const inferSharingUTI = (filename) => {
  const normalized = String(filename || '').toLowerCase();
  if (normalized.endsWith('.xlsx')) {
    return 'org.openxmlformats.spreadsheetml.sheet';
  }

  if (normalized.endsWith('.csv')) {
    return 'public.comma-separated-values-text';
  }

  return undefined;
};

const splitFilename = (filename) => {
  const safeFilename = getSafeFilename(filename);
  const dotIndex = safeFilename.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === safeFilename.length - 1) {
    return { baseName: safeFilename, extension: '' };
  }

  return {
    baseName: safeFilename.slice(0, dotIndex),
    extension: safeFilename.slice(dotIndex + 1),
  };
};

const saveFileInAndroidFolder = async ({ sourceUri, filename, mimeType }) => {
  if (Platform.OS !== 'android') {
    return { savedUri: sourceUri, granted: false, reason: 'unsupported-platform' };
  }

  const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permission?.granted || !permission?.directoryUri) {
    throw new Error('No se otorgó permiso para guardar en una carpeta del dispositivo.');
  }

  const { baseName } = splitFilename(filename);
  const targetUri = await FileSystem.StorageAccessFramework.createFileAsync(
    permission.directoryUri,
    baseName,
    mimeType,
  );

  const content = await FileSystem.readAsStringAsync(sourceUri, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  await FileSystem.StorageAccessFramework.writeAsStringAsync(targetUri, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return { savedUri: targetUri, granted: true };
};

export const downloadFile = async ({
  baseUrl,
  endpointPath,
  filename,
  mimeType = 'text/csv',
  dialogTitle = 'Descargar archivo',
  action = 'share',
}) => {
  const absoluteUrl = resolveAbsoluteUrl(baseUrl, endpointPath);
  const safeFilename = getSafeFilename(filename);
  const targetDirectory = await ensureDownloadDirectory();
  const destinationUri = `${targetDirectory}${safeFilename}`;

  console.info('[downloadFile] Iniciando descarga', { absoluteUrl, destinationUri });

  try {
    const result = await FileSystem.downloadAsync(absoluteUrl, destinationUri, {
      headers: {
        Accept: 'text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream',
      },
    });

    if (result?.status !== 200) {
      throw new Error(`La descarga falló con estado ${result?.status || 'desconocido'}.`);
    }

    const downloadedInfo = await FileSystem.getInfoAsync(result.uri, { size: true });
    if (!downloadedInfo?.exists) {
      throw new Error('El archivo descargado no existe en almacenamiento local.');
    }

    if (Number(downloadedInfo?.size || 0) <= 0) {
      throw new Error('El archivo descargado está vacío.');
    }

    let shareAvailable = false;
    let savedUri = null;

    if (action === 'save') {
      const saveResult = await saveFileInAndroidFolder({
        sourceUri: result.uri,
        filename: safeFilename,
        mimeType,
      });
      savedUri = saveResult.savedUri;
    } else {
      shareAvailable = await Sharing.isAvailableAsync();
      if (shareAvailable) {
        await Sharing.shareAsync(result.uri, {
          mimeType,
          dialogTitle,
          UTI: inferSharingUTI(safeFilename),
        });
      } else {
        console.warn('[downloadFile] Sharing no disponible en este dispositivo', { uri: result.uri });
      }
    }

    console.info('[downloadFile] Descarga completada', {
      uri: result.uri,
      size: downloadedInfo.size,
      status: result.status,
    });

    return {
      uri: result.uri,
      savedUri,
      status: result.status,
      size: downloadedInfo.size,
      shareAvailable,
      action,
    };
  } catch (error) {
    console.error('[downloadFile] Error durante descarga', {
      message: error?.message,
      absoluteUrl,
      destinationUri,
    });

    try {
      await FileSystem.deleteAsync(destinationUri, { idempotent: true });
    } catch (cleanupError) {
      console.warn('[downloadFile] No se pudo limpiar archivo temporal de error', cleanupError?.message || cleanupError);
    }

    throw error;
  }
};
