const { validateTransactionsQuery } = require('../validators/transactionsQuery');
const { validateTransferBody } = require('../validators/transferBody');
const service = require('../services/transactionService');
const { ApiError } = require('../middleware/errors');

exports.list = (req, res) => {
  res.json(service.listTransactions(validateTransactionsQuery(req.query)));
};

exports.createTransfer = (req, res) => {
  if (!req.is('application/json')) {
    throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json');
  }
  const transfer = service.createTransfer(validateTransferBody(req.body));
  res.status(201).location(`/api/transactions?search=${transfer.id}`).json({ data: transfer });
};

exports.accounts = (req, res) => res.json({ data: service.listAccounts() });
