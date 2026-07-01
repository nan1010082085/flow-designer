import type { InjectionKey, Ref } from 'vue'
import type { RejectPolicy } from '@schema-platform/flow-shared'

export const FLOW_DEFAULT_REJECT_POLICY_KEY: InjectionKey<Ref<RejectPolicy>> = Symbol('flowDefaultRejectPolicy')
