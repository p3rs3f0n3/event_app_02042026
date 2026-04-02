const path = require('path');
const { config } = require('../config/env');
const { INITIAL_DB } = require('../data/initialDb');
const { EventAppRepository } = require('./eventAppRepository');
const { PostgresEventAppRepository } = require('./postgresEventAppRepository');

const createRepository = () => {
  if (config.repository.driver === 'file') {
    return new EventAppRepository({
      dbFile: path.join(__dirname, '..', 'eventapp_db.json'),
      initialDb: INITIAL_DB,
    });
  }

  if (config.repository.driver === 'postgres') {
    return new PostgresEventAppRepository();
  }

  throw new Error(`REPOSITORY_DRIVER inválido: ${config.repository.driver}`);
};

module.exports = {
  createRepository,
};
