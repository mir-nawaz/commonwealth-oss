/**
 * Processes events during migration, upgrading from simple notifications to entities.
 */
import { IEventHandler, CWEvent } from '../../../shared/events/interfaces';
import {
  eventToEntity, SubstrateEntityKind,
  ISubstrateDemocracyProposalEvents,
  ISubstrateDemocracyReferendumEvents,
  ISubstrateDemocracyPreimageEvents,
  ISubstrateTreasuryProposalEvents,
  ISubstrateCollectiveProposalEvents,
  ISubstrateSignalingProposalEvents,
} from '../../../shared/events/edgeware/types';

import { factory, formatFilename } from '../../util/logging';
const log = factory.getLogger(formatFilename(__filename));

export default class extends IEventHandler {
  constructor(
    private readonly _models,
    private readonly _chain: string,
  ) {
    super();
  }

  /**
   * Handles an event during the migration process, by creating or updating existing
   * events depending whether we've seen them before.
   */
  public async handle(event: CWEvent) {
    // case by entity type to determine what value to look for
    const createOrUpdateModel = async (fieldName, fieldValue) => {
      const dbEventType = await this._models.ChainEventType.findOne({ where: {
        chain: this._chain,
        event_name: event.data.kind.toString(),
      } });
      if (!dbEventType) {
        log.error(`unknown event type: ${event.data.kind}`);
        return;
      } else {
        log.trace(`found chain event type: ${dbEventType.id}`);
      }
      const queryFieldName = `event_data.${fieldName}`;
      const existingEvent = await this._models.ChainEvent.findOne({ where: {
        chain_event_type_id: dbEventType.id,
        [queryFieldName]: fieldValue,
      } });
      if (existingEvent) {
        existingEvent.event_data = event.data;
        await existingEvent.save();
        log.debug('Existing event found and migrated successfully!');
        return existingEvent;
      } else {
        log.debug('No existing event found, creating new event in db!');
        return this._models.ChainEvent.create({
          chain_event_type_id: dbEventType.id,
          block_number: event.blockNumber,
          event_data: event.data,
        });
      }
    };

    const entityKind = eventToEntity(event.data.kind);
    if (entityKind === null) return null;
    switch (entityKind) {
      case SubstrateEntityKind.DemocracyProposal: {
        const proposalIndex = (event.data as ISubstrateDemocracyProposalEvents).proposalIndex;
        return createOrUpdateModel('proposalIndex', proposalIndex);
      }
      case SubstrateEntityKind.DemocracyReferendum: {
        const referendumIndex = (event.data as ISubstrateDemocracyReferendumEvents).referendumIndex;
        return createOrUpdateModel('referendumIndex', referendumIndex);
      }
      case SubstrateEntityKind.DemocracyPreimage: {
        const proposalHash = (event.data as ISubstrateDemocracyPreimageEvents).proposalHash;
        return createOrUpdateModel('proposalHash', proposalHash);
      }
      case SubstrateEntityKind.TreasuryProposal: {
        const proposalIndex = (event.data as ISubstrateTreasuryProposalEvents).proposalIndex;
        return createOrUpdateModel('proposalIndex', proposalIndex);
      }
      case SubstrateEntityKind.CollectiveProposal: {
        const proposalHash = (event.data as ISubstrateCollectiveProposalEvents).proposalHash;
        return createOrUpdateModel('proposalHash', proposalHash);
      }
      case SubstrateEntityKind.SignalingProposal: {
        const proposalHash = (event.data as ISubstrateSignalingProposalEvents).proposalHash;
        return createOrUpdateModel('proposalHash', proposalHash);
      }
      default: {
        return null;
      }
    }
  }
}
