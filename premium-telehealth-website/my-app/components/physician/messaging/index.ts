/**
 * Messaging Components for Physician-to-Physician Communication
 * 
 * @module components/physician/messaging
 */

export { MessageThreadList } from './MessageThreadList';
export type {
  MessageThreadListProps,
  ThreadParticipant,
  LastMessage,
  MessageThread as MessageThreadType,
} from './MessageThreadList';

export { MessageThread } from './MessageThread';
export type {
  MessageThreadProps,
  Message as MessageType,
  Participant,
} from './MessageThread';

export { ComposeMessage } from './ComposeMessage';
export type {
  ComposeMessageProps,
  Physician,
  PatientOption,
} from './ComposeMessage';

export {
  MessageBubble,
  CompactMessageBubble,
  SystemMessageBubble,
} from './MessageBubble';
export type {
  MessageBubbleProps,
  Message as MessageBubbleType,
  CompactMessageBubbleProps,
  SystemMessageBubbleProps,
} from './MessageBubble';
