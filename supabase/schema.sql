-- ai assistant database schema

-- enable uuid extension
create extension if not exists "uuid-ossp";

-- chats table
create table public.chats (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    title text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- messages table
create table public.messages (
    id uuid default uuid_generate_v4() primary key,
    chat_id uuid references public.chats(id) on delete cascade not null,
    role text not null check (role in ('user', 'assistant', 'system')),
    content text not null,
    files jsonb default '[]'::jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- user settings table
create table public.user_settings (
    user_id uuid references auth.users(id) on delete cascade primary key,
    settings jsonb default '{}'::jsonb,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- indexes for performance
create index chats_user_id_idx on public.chats(user_id);
create index chats_updated_at_idx on public.chats(updated_at desc);
create index messages_chat_id_idx on public.messages(chat_id);
create index messages_created_at_idx on public.messages(created_at);

-- enable row level security
alter table public.chats enable row level security;
alter table public.messages enable row level security;
alter table public.user_settings enable row level security;

-- rls policies for chats
create policy "users can view own chats" on public.chats
    for select using (auth.uid() = user_id);

create policy "users can create own chats" on public.chats
    for insert with check (auth.uid() = user_id);

create policy "users can update own chats" on public.chats
    for update using (auth.uid() = user_id);

create policy "users can delete own chats" on public.chats
    for delete using (auth.uid() = user_id);

-- rls policies for messages
create policy "users can view messages from own chats" on public.messages
    for select using (
        exists (
            select 1 from public.chats
            where chats.id = messages.chat_id
            and chats.user_id = auth.uid()
        )
    );

create policy "users can create messages in own chats" on public.messages
    for insert with check (
        exists (
            select 1 from public.chats
            where chats.id = messages.chat_id
            and chats.user_id = auth.uid()
        )
    );

create policy "users can delete messages from own chats" on public.messages
    for delete using (
        exists (
            select 1 from public.chats
            where chats.id = messages.chat_id
            and chats.user_id = auth.uid()
        )
    );

-- rls policies for user_settings
create policy "users can view own settings" on public.user_settings
    for select using (auth.uid() = user_id);

create policy "users can update own settings" on public.user_settings
    for insert with check (auth.uid() = user_id);

create policy "users can update own settings 2" on public.user_settings
    for update using (auth.uid() = user_id);

-- optional: storage bucket for file uploads
insert into storage.buckets (id, name, public)
values ('chat-files', 'chat-files', false)
on conflict (id) do nothing;

-- storage policies
create policy "authenticated users can upload files" on storage.objects
    for insert with check (
        bucket_id = 'chat-files' 
        and auth.role() = 'authenticated'
    );

create policy "users can view own files" on storage.objects
    for select using (
        bucket_id = 'chat-files' 
        and auth.uid()::text = (storage.foldername(name))[1]
    );

create policy "users can delete own files" on storage.objects
    for delete using (
        bucket_id = 'chat-files' 
        and auth.uid()::text = (storage.foldername(name))[1]
    );
