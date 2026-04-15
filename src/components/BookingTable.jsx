import { FileText, Pencil, Trash2, MapPin } from "lucide-react";

export default function BookingTable({
  bookings = [],
  onInvoice,
  onEdit,
  onDelete,
}) {
  function formatRupiah(value) {
    if (!value) return "Rp 0";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);
  }

  function parseLocalDate(value) {
    if (!value) return null;
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === "string") {
      const parts = value.split("-");
      if (parts.length === 3) {
        const year = Number(parts[0]);
        const month = Number(parts[1]) - 1;
        const day = Number(parts[2]);
        const d = new Date(year, month, day);
        return Number.isNaN(d.getTime()) ? null : d;
      }
    }
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  function formatDate(dateString) {
    if (!dateString) return "-";
    const date = parseLocalDate(dateString);
    if (!date) return "-";
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function formatDayName(dateString) {
    if (!dateString) return "";
    const date = parseLocalDate(dateString);
    if (!date) return "";
    return date.toLocaleDateString("id-ID", { weekday: "short" });
  }

  function formatTime(timeString) {
    if (!timeString) return "";
    return timeString.slice(0, 5);
  }

  function getBookingDateText(booking) {
    if (booking.booking_more_than_one_day) {
      return `${formatDate(booking.booking_start_date)} - ${formatDate(
        booking.booking_end_date
      )}`;
    }
    return formatDate(booking.booking_date);
  }

  function getSingleDayWithDayName(booking) {
    if (!booking || booking.booking_more_than_one_day || !booking.booking_date) {
      return getBookingDateText(booking);
    }
    const dayName = formatDayName(booking.booking_date);
    const dateText = formatDate(booking.booking_date);
    if (!dayName) return dateText;
    return `${dayName}, ${dateText}`;
  }

  function getStatusClass(status) {
    if (status === "Selesai") return "bg-green-100 text-green-700";
    if (status === "Dibatalkan") return "bg-red-100 text-red-700";
    return "bg-blue-100 text-blue-700";
  }

  function getPaymentBadgeClass(status) {
    if (status === "Lunas") return "bg-green-100 text-green-700";
    if (status === "DP") return "bg-orange-100 text-orange-700";
    return "bg-yellow-100 text-yellow-700";
  }

  function getServiceDescription(booking) {
    return (
      booking?.services?.description ||
      booking?.service_description ||
      booking?.service_desc ||
      booking?.description ||
      ""
    );
  }

  function renderServiceList(booking) {
    const qty = Number(booking.quantity || 0);
    const showQty = qty > 1;
    const serviceDescription = getServiceDescription(booking);
    const descLines = serviceDescription
      ? serviceDescription.split(/\n/).map((l) => l.trim()).filter(Boolean)
      : [];

    return (
      <div className="space-y-0.5">
        <div className="text-[14px] font-semibold text-gray-900">
          {booking.service_name || booking?.services?.name || "-"}
          {showQty && (
            <span className="ml-1 font-normal text-gray-400">({qty}x)</span>
          )}
        </div>

        <div className="text-[14px] text-gray-700">
          {formatRupiah(booking.unit_price || booking?.services?.price || 0)}
        </div>

        {descLines.length > 0 && (
          <div className="mt-0.5 space-y-0">
            {descLines.map((line, i) => (
              <div key={i} className="text-[14px] text-gray-600 leading-5">
                {line}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderDateTimeCell(booking) {
    const isMulti = booking.booking_more_than_one_day;
    return (
      <div className="text-gray-900">
        <div className="text-[14px] leading-6">
          {isMulti
            ? getBookingDateText(booking)
            : getSingleDayWithDayName(booking)}
        </div>

        {booking.booking_time && (
          <div className="text-[14px] leading-5 text-gray-700">
            {formatTime(booking.booking_time)}
          </div>
        )}

        {isMulti && (
          <div className="mt-1.5">
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 text-[12px] font-semibold leading-none text-blue-700">
              Multi-hari
            </span>
          </div>
        )}
      </div>
    );
  }

  function renderPaymentCell(booking) {
    const isPaidFull = booking.payment_status === "Lunas";
    const isDP = booking.payment_status === "DP";
    const hasRemaining =
      booking.remaining_amount && Number(booking.remaining_amount) > 0;

    return (
      <div className="space-y-1.5">
        <div>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-[13px] font-semibold leading-none ${getPaymentBadgeClass(
              booking.payment_status
            )}`}
          >
            {isDP ? "Down Payment (DP)" : booking.payment_status}
          </span>
        </div>

        {booking.payment_method && (
          <div>
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-[12px] font-semibold leading-none text-green-700">
              <span>💵</span>
              {booking.payment_method}
            </span>
          </div>
        )}

        <div className="text-[14px] leading-5 text-gray-600">
          Total: {formatRupiah(booking.total_amount)}
        </div>

        {(isDP || hasRemaining) && !isPaidFull && (
          <>
            {booking.paid_amount != null && (
              <div className="text-[14px] leading-5 text-gray-600">
                Dibayar: {formatRupiah(booking.paid_amount)}
              </div>
            )}
            {hasRemaining && (
              <div className="text-[14px] leading-5 text-red-500">
                Sisa: {formatRupiah(booking.remaining_amount)}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-[14%]" />
            <col className="w-[20%]" />
            <col className="w-[22%]" />
            <col className="w-[13%]" />
            <col className="w-[21%]" />
            <col className="w-[10%]" />
          </colgroup>

          <thead className="bg-gray-50 text-gray-500">
            <tr className="border-b border-gray-100">
              <th className="px-6 py-4 text-left text-[13px] font-semibold uppercase tracking-wide">
                KLIEN
              </th>
              <th className="px-6 py-4 text-left text-[13px] font-semibold uppercase tracking-wide">
                LAYANAN
              </th>
              <th className="px-6 py-4 text-left text-[13px] font-semibold uppercase tracking-wide">
                TANGGAL & WAKTU
              </th>
              <th className="px-6 py-4 text-left text-[13px] font-semibold uppercase tracking-wide">
                STATUS
              </th>
              <th className="px-6 py-4 text-left text-[13px] font-semibold uppercase tracking-wide">
                PEMBAYARAN
              </th>
              <th className="px-6 py-4 text-left text-[13px] font-semibold uppercase tracking-wide">
                AKSI
              </th>
            </tr>
          </thead>

          {bookings.length > 0 && (
            <tbody>
              {bookings.map((booking) => (
                <tr
                  key={booking.id}
                  className="border-b border-gray-100 align-top last:border-b-0 hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-6 py-5 text-left align-top">
                    <div className="space-y-0.5">
                      <div className="text-[14px] font-semibold leading-5 text-gray-900">
                        {booking.client_name || "-"}
                      </div>

                      {booking.client_contact && (
                        <div className="text-[14px] leading-5 text-gray-500">
                          {booking.client_contact}
                        </div>
                      )}

                      {booking.client_address && (
                        <div className="flex items-start gap-1 text-[14px] leading-5 text-gray-500">
                          <MapPin
                            size={12}
                            className="mt-[3px] shrink-0 text-red-500"
                          />
                          <span className="break-words">
                            {booking.client_address}
                          </span>
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-5 text-left align-top">
                    {renderServiceList(booking)}
                  </td>

                  <td className="px-6 py-5 text-left align-top">
                    {renderDateTimeCell(booking)}
                  </td>

                  <td className="px-6 py-5 text-left align-top">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-[13px] font-semibold leading-none ${getStatusClass(
                        booking.booking_status
                      )}`}
                    >
                      {booking.booking_status}
                    </span>
                  </td>

                  <td className="px-6 py-5 text-left align-top">
                    {renderPaymentCell(booking)}
                  </td>

                  <td className="px-6 py-5 text-left align-top">
                    <div className="flex items-center gap-3 pt-0.5 text-gray-400">
                      <button
                        type="button"
                        onClick={() => onInvoice && onInvoice(booking)}
                        className="transition-colors hover:text-gray-600"
                        title="Generate Invoice"
                      >
                        <FileText size={16} />
                      </button>

                      <button
                        type="button"
                        onClick={() => onEdit && onEdit(booking)}
                        className="transition-colors hover:text-blue-600"
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </button>

                      <button
                        type="button"
                        onClick={() => onDelete && onDelete(booking.id)}
                        className="transition-colors hover:text-red-600"
                        title="Hapus"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>

      {bookings.length === 0 && (
        <div className="py-20 text-center text-gray-400">
          <p className="font-medium">Belum ada data booking</p>
          <p className="text-sm">
            Klik <b>Tambah Booking</b> untuk memulai
          </p>
        </div>
      )}
    </section>
  );
}