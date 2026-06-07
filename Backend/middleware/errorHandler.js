export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode ||
    (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);
  res.status(statusCode);

  res.json({
    message: err.message,
    reasonCode: err.reasonCode,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};
