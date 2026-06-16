import { logger } from '../utils/logger.js';
import { getFromDb, setInDb } from '../utils/database.js';

const STAFF_ROLE_ID = '1511487812615012543';
const DAILY_MESSAGE_QUOTA = 50;

export function getStaffActivityKey(guildId, userId) {
    return `guild:${guildId}:staff_activity:${userId}`;
}

export function getStaffProtectionKey(guildId) {
    return `guild:${guildId}:staff_protection`;
}

export async function trackMessage(guildId, userId) {
    try {
        const key = getStaffActivityKey(guildId, userId);
        const data = await getFromDb(key, { messages: 0, voiceTimeMs: 0, voiceJoinTimestamp: null });
        data.messages += 1;
        await setInDb(key, data);
    } catch (error) {
        logger.error(`Error tracking message for user ${userId} in guild ${guildId}:`, error);
    }
}

export async function trackVoiceStateUpdate(guildId, userId, oldState, newState) {
    try {
        const key = getStaffActivityKey(guildId, userId);
        const data = await getFromDb(key, { messages: 0, voiceTimeMs: 0, voiceJoinTimestamp: null });
        
        const isJoining = !oldState.channelId && newState.channelId;
        const isLeaving = oldState.channelId && !newState.channelId;

        if (isJoining) {
            data.voiceJoinTimestamp = Date.now();
        } else if (isLeaving) {
            if (data.voiceJoinTimestamp) {
                data.voiceTimeMs += Date.now() - data.voiceJoinTimestamp;
                data.voiceJoinTimestamp = null;
            }
        }
        
        await setInDb(key, data);
    } catch (error) {
        logger.error(`Error tracking voice state for user ${userId} in guild ${guildId}:`, error);
    }
}

export async function isStaffProtected(guildId, userId) {
    try {
        const key = getStaffProtectionKey(guildId);
        const protections = await getFromDb(key, {});
        return !!protections[userId];
    } catch (error) {
        logger.error(`Error checking staff protection for user ${userId}:`, error);
        return false;
    }
}

export async function setStaffProtection(guildId, userId, isProtected) {
    try {
        const key = getStaffProtectionKey(guildId);
        const protections = await getFromDb(key, {});
        if (isProtected) {
            protections[userId] = true;
        } else {
            delete protections[userId];
        }
        await setInDb(key, protections);
        return true;
    } catch (error) {
        logger.error(`Error setting staff protection for user ${userId}:`, error);
        return false;
    }
}

export async function checkStaffActivity(client) {
    try {
        logger.info('Running daily staff activity check...');
        for (const [guildId, guild] of client.guilds.cache) {
            const protections = await getFromDb(getStaffProtectionKey(guildId), {});
            
            try {
                // Fetch members to check for STAFF role
                await guild.members.fetch();
            } catch (err) {
                logger.error(`Failed to fetch members for guild ${guildId}`, err);
                continue;
            }

            const staffMembers = guild.members.cache.filter(m => m.roles.cache.has(STAFF_ROLE_ID));
            
            for (const [userId, member] of staffMembers) {
                if (protections[userId]) {
                    // Skip protected members, dar resetează statusul pentru a doua zi
                    const key = getStaffActivityKey(guildId, userId);
                    const data = await getFromDb(key, { messages: 0, voiceTimeMs: 0, voiceJoinTimestamp: null });
                    data.messages = 0;
                    data.voiceTimeMs = 0;
                    await setInDb(key, data);
                    continue;
                }

                const key = getStaffActivityKey(guildId, userId);
                const data = await getFromDb(key, { messages: 0, voiceTimeMs: 0, voiceJoinTimestamp: null });
                
                if (data.messages < DAILY_MESSAGE_QUOTA) {
                    // Trimitem avertismentul în mesaj privat
                    try {
                        await member.send(`⚠️ **Staff Warning**: Nu ai atins target-ul zilnic de ${DAILY_MESSAGE_QUOTA} mesaje (ai trimis doar ${data.messages}). Te rugăm să fii mai activ pe chat!`);
                    } catch (e) {
                        logger.warn(`Could not DM staff member ${member.user.tag} for warning.`);
                    }
                }

                // Resetăm progresul pentru ziua care urmează
                data.messages = 0;
                data.voiceTimeMs = 0;
                if (data.voiceJoinTimestamp) {
                    data.voiceJoinTimestamp = Date.now();
                }
                await setInDb(key, data);
            }
        }
    } catch (error) {
        logger.error('Error during daily staff activity check:', error);
    }
}
