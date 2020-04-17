import { ISubstrateEventType, SubstrateBalanceString } from '../types';

export interface IEventLabel {
  heading: string;
  label: string;
  linkUrl?: string;
}

function formatAddressShort(addr : string) {
  if (!addr) return;
  if (addr.length < 16) return addr;
  return `${addr.slice(0, 5)}…${addr.slice(addr.length - 3)}`;
}

export default function (
  blockNumber: number,
  data: ISubstrateEventType,
  balanceFormatter: (balance: SubstrateBalanceString) => string = (s) => s,
): IEventLabel {
  switch (data.kind) {
    case 'slash': {
      const { validator, amount } = data;
      return {
        heading: 'Validator Slashed',
        label: `Validator ${formatAddressShort(validator)} was slashed by amount ${balanceFormatter(amount)}.`,
      };
    }
    case 'reward': {
      const { validator, amount } = data;
      return {
        heading: 'Validator Rewarded',
        label: `Validator ${formatAddressShort(validator)} was rewarded by amount ${balanceFormatter(amount)}.`,
      };
    }
    case 'democracy-proposed': {
      const { deposit } = data;
      return {
        heading: 'Democracy Proposal Created',
        label: `A new Democracy proposal was introduced with deposit ${balanceFormatter(deposit)}.`,
        linkUrl: null, // TODO
      };
    }
    case 'democracy-started': {
      const { endBlock, referendumIndex } = data;
      return {
        heading: 'Democracy Referendum Started',
        label: endBlock
          ? `Referendum ${referendumIndex} has started, voting until block ${endBlock}.`
          : `Referendum ${referendumIndex} has started.`,
        linkUrl: null, // TODO
      };
    }
    case 'democracy-passed': {
      const { dispatchBlock, referendumIndex } = data;
      return {
        heading: 'Democracy Referendum Passed',
        label: dispatchBlock
          ? `Referendum ${referendumIndex} has passed and will be dispatched on block ${dispatchBlock}.`
          : `Referendum ${referendumIndex} has passed was dispatched on block ${blockNumber}`,
        linkUrl: null, // TODO ???
      };
    }
    case 'democracy-not-passed': {
      const { referendumIndex } = data;
      return {
        heading: 'Democracy Referendum Failed',
        // TODO: include final tally?
        label: `Referendum ${referendumIndex} has failed.`,
        linkUrl: null, // will this exist?
      };
    }
    case 'democracy-cancelled': {
      const { referendumIndex } = data;
      return {
        heading: 'Democracy Referendum Cancelled',
        // TODO: include cancellation vote?
        label: `Referendum ${referendumIndex} was cancelled.`,
        linkUrl: null, // will this exist?
      };
    }
    default: {
      throw new Error('unknown event type');
    }
  }
}