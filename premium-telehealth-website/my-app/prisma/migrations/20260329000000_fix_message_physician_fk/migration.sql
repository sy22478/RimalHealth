-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT IF EXISTS "message_physician_fk";
ALTER TABLE "Message" DROP CONSTRAINT IF EXISTS "Message_senderId_fkey";
