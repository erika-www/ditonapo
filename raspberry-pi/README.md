# Raspberry Pi 3 Bus Direction Listener

The listener polls Supabase for commands addressed to the bus assigned to its device key. A Northbound command drives BCM GPIO 17 high and BCM GPIO 27 low; Southbound drives GPIO 17 low and GPIO 27 high. Both pins are configurable. Use a proper driver/isolator for the vehicle control input; do not connect Raspberry Pi GPIO directly to automotive or relay loads.

## Install

On Raspberry Pi OS, install Python, `requests`, and `RPi.GPIO` using the OS packages:

```sh
sudo apt update
sudo apt install -y python3-requests python3-rpi.gpio
```

Apply the Supabase migration and deploy the Edge Function:

```sh
supabase db push
supabase functions deploy bus-direction --no-verify-jwt
```

Create a random device key for this bus. Store only its SHA-256 hash in `public.device_keys` with the bus UUID and a device name; keep the plaintext key on the Pi. Never put the service-role key on the device. The key can also be revoked by setting `revoked_at`.

Configure the process environment:

```sh
export SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
export SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
export DEVICE_KEY="YOUR_DEVICE_KEY"
export NORTHBOUND_PIN="17"
export SOUTHBOUND_PIN="27"
```

Run it as a service account with GPIO access:

```sh
sudo -E python3 raspberry-pi/direction_listener.py
```

The last applied command ID is stored at `/var/lib/dito-na-po/direction.json` by default, so a restart does not replay older commands. Set `COMMAND_STATE_FILE` or `POLL_INTERVAL_SECONDS` to override those defaults.

## GPS Packets

The admin duty screen subscribes to `public.bus_current_location` and uses each fresh packet for stop-arrival detection. The Pi GPS sender should POST JSON containing `latitude`, `longitude`, optional `speed`, `heading`, `accuracy`, and `recorded_at` to `/functions/v1/ingest-gps` with the same `x-device-key` and the Supabase anon key as `apikey`. The existing `ingest-gps` function validates the key, records history, and updates the realtime current-location row.
