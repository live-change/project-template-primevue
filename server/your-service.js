const app = require('@live-change/framework').app()

const service = app.createServiceDefinition({
  name: 'your-service'
})

const Session = service.foreignModel('session', 'Session')

const YourData = service.model({
  name: 'YourData',
  properties: {
    text: {
      type: String,
      validation: ['nonEmpty']
    },
    number: {
      type: Number
    },
    bool: {
      type: Boolean
    },
    timestamp: {
      type: Date,
      validation: ['nonEmpty']
    },
    session: {
      type: Session,
      validation: ['nonEmpty']
    }
  },
  indexes: {
    byTimestamp: {
      property: ['timestamp']
    }
  }
})

service.action({
  name: 'createData',
  properties: {
    ...YourData.properties
  },
  async execute(data, { client, service }, emit) {
    const id = app.generateUid()
    const timestamp = new Date()
    return await Data.create({ ...data, timestamp, id, session: client.session })
  }
})

service.view({
  name: 'dataByTimestamp',
  properties: {
    ...app.Range
  },
  async daoPath(userRange, { client, service }, method) {
    const range = {
      ...userRange,
      limit: (parameters.limit && parameters.limit < 100) ? parameters.limit : 100
    }
    return Message.sortedIndexRangePath('byTimestamp', range)
  }
})


module.exports = service
