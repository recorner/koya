// Deprecated shim: keep existing imports compiling while migrating to the
// provider-style backend contract.
export {
  BTC_BACKEND_PROVIDER as BTC_DELIVERY_PROVIDER,
  type BtcBackendProvider as BtcDeliveryProvider,
  type BtcSubmitPayoutInput as BtcSendInput,
  type BtcSubmitPayoutResult as BtcSendResult,
} from './btc-backend.interface';
