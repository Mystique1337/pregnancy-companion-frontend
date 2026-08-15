"""Hold the voice models warm across the demo window, and only across it.

SoroTTS and Whisper run scale-to-zero, which is what makes the unit economics on
the deck honest: we pay for GPU seconds, not for GPU hours. The cost of that is a
cold start of roughly 30 to 60 seconds on the first request after an idle spell,
which is fine for a mother at 2am and ruinous on stage.

So this pins one container per model for the demo window and lets both fall back
to zero afterwards. Nothing about the voice apps themselves changes; this reaches
in from outside and moves their autoscaler, so there is no redeploy of the models
and no risk to the running endpoints.

    Window   11:30 to 15:00 Africa/Lagos, every day
    Cost     two GPUs held for 3.5h/day. That is the whole point, and it is not free.

Deploy (note the profile — these apps live on chidi-ashinze, not the default):

    MODAL_PROFILE=chidi-ashinze modal deploy modal/voice_warm.py

Manual override, any time:

    MODAL_PROFILE=chidi-ashinze modal run modal/voice_warm.py::warm_up
    MODAL_PROFILE=chidi-ashinze modal run modal/voice_warm.py::cool_down
"""

import modal

app = modal.App("bumply-voice-warmup")

# (deployed app, class). Both are @app.cls classes, so the autoscaler lives on an
# instance handle rather than on a plain Function.
VOICE = [
    ("buildsmall-tts", "TTS"),          # SoroTTS   → MODAL_TTS_URL
    ("buildsmall-whisper", "ASR"),      # Whisper   → MODAL_ASR_URL
]

TZ = "Africa/Lagos"                     # WAT, no daylight saving to trip over
WARM = 1                                # one resident container per model


def _set(min_containers: int) -> None:
    """Move both voice models to `min_containers`, reporting each one separately.

    One model failing must not stop the other from being set. A half-applied
    change is recoverable; an unhandled exception that leaves a GPU pinned
    overnight is just a bill.
    """
    for app_name, cls_name in VOICE:
        target = f"{app_name}.{cls_name}"
        try:
            modal.Cls.from_name(app_name, cls_name)().update_autoscaler(
                min_containers=min_containers
            )
            print(f"ok    {target} -> min_containers={min_containers}")
        except Exception as e:
            # Printed, not raised: see the docstring above.
            print(f"FAIL  {target}: {type(e).__name__}: {e}")


@app.function(schedule=modal.Cron("30 11 * * *", timezone=TZ))
def warm_up() -> None:
    """11:30 — pin one container per model so the first request is instant."""
    _set(WARM)


@app.function(schedule=modal.Cron("0 15 * * *", timezone=TZ))
def cool_down() -> None:
    """15:00 — release them. They idle out on their own scaledown window."""
    _set(0)


@app.function(schedule=modal.Cron("50 23 * * *", timezone=TZ))
def ensure_cold() -> None:
    """23:50 — belt and braces.

    If the 15:00 run is ever missed, two GPUs stay pinned until someone notices,
    which on a scale-to-zero budget is the one failure worth paying three lines
    of code to avoid. Setting min_containers=0 when it is already 0 is a no-op.
    """
    _set(0)
