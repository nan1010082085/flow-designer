<template>
  <div :class="$style.callback">
    <AppIcon name="loading" :class="$style.spinner" :size="32" />
    <p :class="$style.text">正在完成登录...</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { SSOClient } from '@schema-platform/platform-shared/utils/sso'
import {
  persistSSOClientId,
  startTokenRefreshSchedule,
  bootstrapAuthSession,
} from '@schema-platform/platform-shared/utils/authSession'
import { useAuthStore } from '@schema-platform/platform-shared/utils/stores/authStore'
import AppIcon from '@schema-platform/platform-shared/components/common/AppIcon.vue'

const router = useRouter()
const route = useRoute()

onMounted(async () => {
  const origin = window.location.origin
  const clientId = 'flow'
  persistSSOClientId(clientId)
  const client = new SSOClient({
    clientId,
    redirectUri: `${origin}${import.meta.env.BASE_URL}auth/callback`,
    ssoBaseUrl: origin,
  })

  try {
    const tokens = await client.handleCallback()
    const authStore = useAuthStore()
    authStore.setTokens(tokens.accessToken, tokens.refreshToken)
    // Fetch user info after getting tokens
    await bootstrapAuthSession()
    startTokenRefreshSchedule(tokens.expiresIn)

    const redirect = route.query.redirect as string | undefined
    await router.replace(redirect || '/')
  } catch {
    await router.replace({ name: 'not-found' })
  }
})
</script>

<style module>
.callback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  gap: 16px;
}

.spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.text {
  color: var(--text-color-secondary);
  font-size: 14px;
}
</style>
