function getAddressLines(address) {
  if (!address) {
    return []
  }

  return [address.addressLine1, address.addressLine2].filter(Boolean)
}

export default function OrderDeliverySummary({ delivery }) {
  return (
    <div className="aurora-solid-plate rounded-[1.75rem] p-5">
      <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
        Delivery summary
      </p>
      {delivery ? (
        <div className="mt-4 text-sm leading-8 text-[var(--aurora-text)]">
          {delivery.fullName ? (
            <p className="font-semibold text-[var(--aurora-text-strong)]">
              {delivery.fullName}
            </p>
          ) : null}
          {getAddressLines(delivery).map((line) => (
            <p key={line}>{line}</p>
          ))}
          <p>
            {delivery.district}, {delivery.province} {delivery.postalCode}
          </p>
          {delivery.phone ? <p>{delivery.phone}</p> : null}
        </div>
      ) : (
        <p className="mt-4 text-sm leading-7 text-[var(--aurora-text)]">
          Delivery details are not available for this order.
        </p>
      )}
    </div>
  )
}
