-- Add foreign key constraints to messages.sender_id and messages.receiver_id
ALTER TABLE public.messages
  ADD CONSTRAINT messages_sender_id_fkey
  FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_receiver_id_fkey
  FOREIGN KEY (receiver_id) REFERENCES auth.users(id) ON DELETE CASCADE;
