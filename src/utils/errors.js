function classifyError(error) {
  const message = String(error?.message || error || '');
  const lower = message.toLowerCase();

  if (lower.includes('cannot parse data') || lower.includes('unsupported url') || lower.includes('extractor')) {
    return {
      code: 'EXTRACTOR_FAILED',
      statusCode: 502,
      message: 'The provider extractor could not read this media page. Try another public link or retry later.'
    };
  }

  if (lower.includes('private') || lower.includes('login') || lower.includes('cookies')) {
    return {
      code: 'COOKIES_REQUIRED',
      statusCode: 403,
      message: 'This media appears to require login or cookies. Public links work best.'
    };
  }

  if (lower.includes('enotfound') || lower.includes('econnrefused') || lower.includes('timed out') || lower.includes('timeout')) {
    return {
      code: 'PROVIDER_UNAVAILABLE',
      statusCode: 503,
      message: 'A provider is temporarily unavailable. The daemon can retry or use another fallback.'
    };
  }

  if (lower.includes('valid http')) {
    return {
      code: 'INVALID_URL',
      statusCode: 400,
      message: 'A valid http(s) URL is required.'
    };
  }

  return {
    code: error?.code || 'DOWNLOAD_FAILED',
    statusCode: error?.statusCode || error?.status || 502,
    message: message || 'Download failed.'
  };
}

function attachErrorMetadata(error) {
  const classified = classifyError(error);
  error.code = error.code || classified.code;
  error.statusCode = error.statusCode || classified.statusCode;
  error.publicMessage = error.publicMessage || classified.message;
  return error;
}

function userFacingError(error) {
  const classified = error?.publicMessage ? error : classifyError(error);
  return classified.publicMessage || classified.message || 'Download failed.';
}

module.exports = {
  attachErrorMetadata,
  classifyError,
  userFacingError
};
