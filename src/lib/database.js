// database operations

async function createChat(title) {
    if (!supabase || !currentUser) return null;

    try {
        const { data, error } = await supabase
            .from('chats')
            .insert([
                {
                    user_id: currentUser.id,
                    title: title || 'new chat',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }
            ])
            .select()
            .single();

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('failed to create chat:', error);
        return null;
    }
}

async function saveMessage(chatId, role, content, files = []) {
    if (!supabase || !currentUser) return null;

    try {
        const { data, error } = await supabase
            .from('messages')
            .insert([
                {
                    chat_id: chatId,
                    role: role,
                    content: content,
                    files: files,
                    created_at: new Date().toISOString()
                }
            ])
            .select()
            .single();

        if (error) throw error;

        // update chat's updated_at
        await supabase
            .from('chats')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', chatId);

        return data;
    } catch (error) {
        console.error('failed to save message:', error);
        return null;
    }
}

async function loadChats() {
    if (!supabase || !currentUser) return [];

    try {
        const { data, error } = await supabase
            .from('chats')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('updated_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        return data || [];
    } catch (error) {
        console.error('failed to load chats:', error);
        return [];
    }
}

async function loadMessages(chatId) {
    if (!supabase) return [];

    try {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('chat_id', chatId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        return data || [];
    } catch (error) {
        console.error('failed to load messages:', error);
        return [];
    }
}

async function deleteChat(chatId) {
    if (!supabase || !currentUser) return false;

    try {
        // delete messages first (cascade should handle this, but just in case)
        await supabase
            .from('messages')
            .delete()
            .eq('chat_id', chatId);

        // delete chat
        const { error } = await supabase
            .from('chats')
            .delete()
            .eq('id', chatId)
            .eq('user_id', currentUser.id);

        if (error) throw error;

        return true;
    } catch (error) {
        console.error('failed to delete chat:', error);
        return false;
    }
}

async function updateChatTitle(chatId, title) {
    if (!supabase) return false;

    try {
        const { error } = await supabase
            .from('chats')
            .update({ 
                title: title,
                updated_at: new Date().toISOString()
            })
            .eq('id', chatId);

        if (error) throw error;

        return true;
    } catch (error) {
        console.error('failed to update chat title:', error);
        return false;
    }
}

async function saveUserSettings(settings) {
    if (!supabase || !currentUser) return false;

    try {
        const { error } = await supabase
            .from('user_settings')
            .upsert([
                {
                    user_id: currentUser.id,
                    settings: settings,
                    updated_at: new Date().toISOString()
                }
            ]);

        if (error) throw error;

        return true;
    } catch (error) {
        console.error('failed to save settings:', error);
        return false;
    }
}

async function loadUserSettings() {
    if (!supabase || !currentUser) return null;

    try {
        const { data, error } = await supabase
            .from('user_settings')
            .select('settings')
            .eq('user_id', currentUser.id)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        return data?.settings || null;
    } catch (error) {
        console.error('failed to load settings:', error);
        return null;
    }
}
