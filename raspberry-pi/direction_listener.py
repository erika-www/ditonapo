import json
import os
import time
from pathlib import Path

import requests
import RPi.GPIO as GPIO


SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_ANON_KEY = os.environ["SUPABASE_ANON_KEY"]
DEVICE_KEY = os.environ["DEVICE_KEY"]
NORTHBOUND_PIN = int(os.environ.get("NORTHBOUND_PIN", "17"))
SOUTHBOUND_PIN = int(os.environ.get("SOUTHBOUND_PIN", "27"))
POLL_INTERVAL = float(os.environ.get("POLL_INTERVAL_SECONDS", "1"))
STATE_FILE = Path(os.environ.get("COMMAND_STATE_FILE", "/var/lib/dito-na-po/direction.json"))
COMMANDS_URL = f"{SUPABASE_URL}/functions/v1/bus-direction"


def load_last_command_id():
    try:
        return max(0, int(json.loads(STATE_FILE.read_text()).get("last_command_id", 0)))
    except (FileNotFoundError, ValueError, TypeError, json.JSONDecodeError):
        return None


def save_last_command_id(command_id):
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    temporary_file = STATE_FILE.with_suffix(".tmp")
    temporary_file.write_text(json.dumps({"last_command_id": command_id}))
    temporary_file.replace(STATE_FILE)


def apply_direction(direction):
    if direction not in ("Northbound", "Southbound"):
        raise ValueError(f"Unsupported direction: {direction}")
    GPIO.output(NORTHBOUND_PIN, direction == "Northbound")
    GPIO.output(SOUTHBOUND_PIN, direction == "Southbound")
    print(f"Applied {direction}", flush=True)


def poll_commands(session, last_command_id):
    params = {} if last_command_id is None else {"after_id": last_command_id}
    response = session.get(
        COMMANDS_URL,
        params=params,
        headers={"apikey": SUPABASE_ANON_KEY, "x-device-key": DEVICE_KEY},
        timeout=10,
    )
    response.raise_for_status()
    payload = response.json()
    if not payload.get("success"):
        raise RuntimeError(payload.get("error", "Direction poll failed"))

    for command in payload.get("commands", []):
        command_id = int(command["id"])
        apply_direction(command["direction"])
        save_last_command_id(command_id)
        last_command_id = command_id
    return last_command_id


def main():
    if NORTHBOUND_PIN == SOUTHBOUND_PIN:
        raise ValueError("Northbound and Southbound GPIO pins must be different.")

    GPIO.setmode(GPIO.BCM)
    GPIO.setup(NORTHBOUND_PIN, GPIO.OUT, initial=GPIO.LOW)
    GPIO.setup(SOUTHBOUND_PIN, GPIO.OUT, initial=GPIO.LOW)

    session = requests.Session()
    last_command_id = load_last_command_id()
    print("Listening for bus direction commands", flush=True)
    try:
        while True:
            try:
                last_command_id = poll_commands(session, last_command_id)
            except (requests.RequestException, ValueError, KeyError, RuntimeError) as error:
                print(f"Direction poll failed: {error}", flush=True)
            time.sleep(POLL_INTERVAL)
    except KeyboardInterrupt:
        pass
    finally:
        session.close()
        GPIO.cleanup()


if __name__ == "__main__":
    main()