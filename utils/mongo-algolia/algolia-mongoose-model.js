/* @flow */
import { reduce, omit, find, map, pick } from 'lodash';
import User from '../../models/User';

export default function createAlgoliaMongooseModel({
  index,
  attributesToIndex,
}) {
  class AlgoliaMongooseModel {
    // * clears algolia index
    // * removes `_algoliaObjectID` from documents
    static async clearAlgoliaIndex() {
      await index.clearIndex();
      await this.collection.updateMany(
        { _algoliaObjectID: { $exists: true } },
        { $set: { _algoliaObjectID: null } }
      );
    }

    // * clears algolia index
    // * push collection to algolia index
    static async syncWithAlgolia() {
      await this.clearAlgoliaIndex();
      const docs = await this.find({ _algoliaObjectID: { $eq: null } });

      await Promise.all(
        docs.map(async doc => {
          const object = pick(doc.toJSON(), attributesToIndex);
          if (object.author) {
            const user = await User.findById(
              object.author,
              'firstName lastName username'
            );
            if (user) {
              object.author = user;
              object.numOfLikes = doc.likes ? doc.likes.length : 0
              object.numOfComments = doc.comments ? doc.comments.length : 0
              object.engagementScore = object.numOfLikes + object.numOfComments;
              object.image = doc.image;
            }
          }
          object.objectID = doc._id;
          const { objectID } = await index.addObject(object);

          await this.updateOne(
            { _id: doc._id },
            { $set: { _algoliaObjectID: objectID } },
            { upsert: true }
          );
        })
      );
    }

    // * set one or more settings of the algolia index
    static setAlgoliaIndexSettings(settings, forwardToReplicas) {
      return index.setSettings(settings, { forwardToReplicas });
    }

    // * search the index
    static async algoliaSearch({ query, params, populate }) {
      const searchParams = { ...params, query };
      const data = await index.search(searchParams);

      // * populate hits with content from mongodb
      if (populate) {
        // find objects into mongodb matching `objectID` from Algolia search
        const hitsFromMongoose = await this.find(
          {
            _algoliaObjectID: { $in: map(data.hits, 'objectID') },
          },
          reduce(
            this.schema.obj,
            (results, val, key) => ({ ...results, [key]: 1 }),
            { _algoliaObjectID: 1 }
          )
        );

        // add additional data from mongodb into Algolia hits
        const populatedHits = data.hits.map(hit => {
          const ogHit = find(hitsFromMongoose, {
            _algoliaObjectID: hit.objectID,
          });

          return omit(
            {
              ...(ogHit ? ogHit.toJSON() : {}),
              ...hit,
            },
            ['_algoliaObjectID']
          );
        });

        data.hits = populatedHits;
      }

      return data;
    }

    // * push new document to algolia
    // * update document with `_algoliaObjectID`
    async addObjectToAlgolia() {
      const object = pick(this.toJSON(), attributesToIndex);
      if (object.author) {
        const user = await User.findById(
          object.author,
          'firstName lastName username'
        );
        if (user) {
          object.author = user;
          object.numOfLikes = user.likes ? user.likes.length : 0
          object.numOfComments = user.comments ? user.comments.length : 0
          object.engagementScore = object.numOfLikes + object.numOfComments;
          object.image = user.image;
        }
      }
      object.objectID = this._id;
      const { objectID } = await index.addObject(object);

      this.collection.updateOne(
        { _id: this._id },
        { $set: { _algoliaObjectID: objectID } }
      );
    }

    // * update object into algolia index
    async updateObjectToAlgolia() {
      const object = pick(this.toJSON(), attributesToIndex);
      await index.saveObject({ ...object, objectID: this._algoliaObjectID });
    }

    // * delete object from algolia index
    async deleteObjectFromAlgolia() {
      await index.deleteObject(this._id.toString());
    }

    // * schema.post('save')
    postSaveHook() {
      if (this._algoliaObjectID) {
        this.updateObjectToAlgolia();
      } else {
        this.addObjectToAlgolia();
      }
    }

    // * schema.post('update')
    postUpdateHook() {
      if (this._algoliaObjectID) {
        this.updateObjectToAlgolia();
      }
    }

    // * schema.post('remove')
    postRemoveHook() {
      if (this._algoliaObjectID) {
        this.deleteObjectFromAlgolia();
      }
    }
  }

  return AlgoliaMongooseModel;
}
