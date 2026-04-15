import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function BookingCalendar({ bookings = [] }) {
  const today = new Date();

  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());

  const monthName = new Date(currentYear, currentMonth).toLocaleDateString(
    "id-ID",
    {
      month: "long",
      year: "numeric",
    }
  );

  const daysOfWeek = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

  function prevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  }

  function formatTime(timeString) {
    if (!timeString) return "";
    return String(timeString).slice(0, 5);
  }

  function formatDateLabel(dateValue) {
    if (!dateValue) return "-";
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return "-";

    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function isSameDate(a, b) {
    if (!a || !b) return false;
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function getStatusColor(status) {
    if (status === "Selesai") {
      return "bg-green-200 border-green-400 text-green-900";
    }
    if (status === "Dibatalkan") {
      return "bg-red-200 border-red-400 text-red-900";
    }
    return "bg-blue-200 border-blue-400 text-blue-900";
  }

  function getStatusDotColor(status) {
    if (status === "Selesai") return "bg-green-600";
    if (status === "Dibatalkan") return "bg-red-600";
    return "bg-blue-600";
  }

  function getTotalBookingDays(booking) {
    if (!booking.booking_start_date || !booking.booking_end_date) return 1;

    const start = new Date(booking.booking_start_date);
    const end = new Date(booking.booking_end_date);

    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const diff = Math.floor((end - start) / (1000 * 60 * 60 * 24));
    return diff + 1;
  }

  function getCurrentDayNumberInRange(booking, dateObj) {
    if (!booking?.booking_start_date || !dateObj) return 1;

    const start = new Date(booking.booking_start_date);
    const current = new Date(dateObj);

    start.setHours(0, 0, 0, 0);
    current.setHours(0, 0, 0, 0);

    const diff = Math.floor((current - start) / (1000 * 60 * 60 * 24));
    return diff + 1;
  }

  function getShortText(text, max = 16) {
    const value = String(text || "").trim();
    if (!value) return "-";
    if (value.length <= max) return value;
    return `${value.slice(0, max)}...`;
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

  function getSimpleServiceDescription(booking) {
    const raw = getServiceDescription(booking);
    if (!raw) return "";

    const firstLine = raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)[0];

    return getShortText(firstLine || raw, 20);
  }

  function getBookingLabel(booking, dateObj) {
    const clientName = booking?.client_name || "Klien";
    const shortClient = getShortText(clientName, 10);

    if (booking.booking_more_than_one_day) {
      const dayNumber = getCurrentDayNumberInRange(booking, dateObj);
      return `${shortClient} • Hari ${dayNumber}/${getTotalBookingDays(booking)}`;
    }

    const timeText = formatTime(booking.booking_time);
    return timeText ? `${timeText} • ${shortClient}` : shortClient;
  }

  function getBookingSubLabel(booking) {
    const mainService = booking?.service_name || booking?.services?.name || "Booking";
    const shortService = getShortText(mainService, 14);
    const simpleDesc = getSimpleServiceDescription(booking);

    if (simpleDesc) {
      return `${shortService} • ${simpleDesc}`;
    }

    return shortService;
  }

  function getBookingTooltip(booking, dateObj) {
    const status = booking?.booking_status || "-";
    const client = booking?.client_name || "-";
    const service = booking?.service_name || booking?.services?.name || "Booking";
    const description = getServiceDescription(booking);
    const qty = Number(booking?.quantity || 1);
    const time = formatTime(booking?.booking_time) || "-";

    if (booking.booking_more_than_one_day) {
      const dayNumber = getCurrentDayNumberInRange(booking, dateObj);
      const totalDays = getTotalBookingDays(booking);

      return [
        `Klien: ${client}`,
        `Layanan: ${service}`,
        description ? `Deskripsi: ${description}` : null,
        `Qty: ${qty}`,
        `Tanggal: ${formatDateLabel(booking.booking_start_date)} - ${formatDateLabel(
          booking.booking_end_date
        )}`,
        `Hari ke: ${dayNumber}/${totalDays}`,
        `Waktu: ${time}`,
        `Status: ${status}`,
      ]
        .filter(Boolean)
        .join("\n");
    }

    return [
      `Klien: ${client}`,
      `Layanan: ${service}`,
      description ? `Deskripsi: ${description}` : null,
      `Qty: ${qty}`,
      `Tanggal: ${formatDateLabel(booking.booking_date)}`,
      `Waktu: ${time}`,
      `Status: ${status}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  function getBookingsForDate(dateObj) {
    const results = bookings.filter((booking) => {
      if (booking.booking_more_than_one_day) {
        if (!booking.booking_start_date || !booking.booking_end_date) {
          return false;
        }

        const start = new Date(booking.booking_start_date);
        const end = new Date(booking.booking_end_date);

        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);

        const target = new Date(dateObj);
        target.setHours(0, 0, 0, 0);

        return target >= start && target <= end;
      }

      if (!booking.booking_date) return false;

      const bookingDate = new Date(booking.booking_date);
      bookingDate.setHours(0, 0, 0, 0);

      const target = new Date(dateObj);
      target.setHours(0, 0, 0, 0);

      return bookingDate.getTime() === target.getTime();
    });

    return results.sort((a, b) => {
      const timeA = String(a?.booking_time || "99:99");
      const timeB = String(b?.booking_time || "99:99");
      return timeA.localeCompare(timeB);
    });
  }

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDateOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    let startDay = firstDayOfMonth.getDay() - 1;
    if (startDay < 0) startDay = 6;

    const days = [];

    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }

    for (let d = 1; d <= lastDateOfMonth; d++) {
      days.push(d);
    }

    return days;
  }, [currentYear, currentMonth]);

  return (
    <section className="bg-white rounded-2xl p-6 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-base capitalize">
          Kalender {monthName}
        </h3>

        <div className="flex gap-2">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200"
          >
            <ChevronLeft size={18} />
          </button>

          <button
            onClick={nextMonth}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-6 mb-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-blue-600"></span>
          <span className="text-gray-700">Dijadwalkan</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-600"></span>
          <span className="text-gray-700">Selesai</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-600"></span>
          <span className="text-gray-700">Dibatalkan</span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-3 mb-3 text-center text-sm text-gray-500 font-medium">
        {daysOfWeek.map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-3">
        {calendarDays.map((day, index) => {
          const dateObj = day ? new Date(currentYear, currentMonth, day) : null;
          const dayBookings = dateObj ? getBookingsForDate(dateObj) : [];
          const isToday = dateObj ? isSameDate(dateObj, today) : false;

          return (
            <div
              key={index}
              className={`h-32 rounded-xl border text-sm p-2 transition ${
                day
                  ? isToday
                    ? "bg-blue-50 border-blue-300"
                    : "bg-white border-gray-200"
                  : "bg-gray-50 border-dashed border-gray-200"
              }`}
            >
              {day && (
                <div className="flex items-center justify-between">
                  <div
                    className={`text-xs font-semibold ${
                      isToday ? "text-blue-700" : "text-gray-400"
                    }`}
                  >
                    {isToday ? "Hari ini" : ""}
                  </div>

                  <div
                    className={`text-right font-medium ${
                      isToday ? "text-blue-700" : "text-gray-600"
                    }`}
                  >
                    {day}
                  </div>
                </div>
              )}

              <div className="mt-2 space-y-1 overflow-y-auto max-h-[92px] pr-1">
                {dayBookings.map((booking) => (
                  <div
                    key={`${booking.id}-${day}`}
                    className={`rounded-lg px-2 py-1.5 border ${getStatusColor(
                      booking.booking_status
                    )}`}
                    title={getBookingTooltip(booking, dateObj)}
                  >
                    <div className="flex items-start gap-1">
                      <span
                        className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${getStatusDotColor(
                          booking.booking_status
                        )}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-semibold leading-4 truncate">
                          {getBookingLabel(booking, dateObj)}
                        </div>

                        <div className="text-[10px] leading-4 opacity-90 truncate">
                          {getBookingSubLabel(booking)}
                        </div>

                        {booking.booking_more_than_one_day && (
                          <div className="mt-1 text-[9px] font-semibold uppercase tracking-wide opacity-80">
                            Booking multi-hari
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {bookings.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <p className="font-medium">Belum ada data booking</p>
          <p className="text-sm">
            Klik <b>Tambah Booking</b> untuk memulai
          </p>
        </div>
      )}
    </section>
  );
}