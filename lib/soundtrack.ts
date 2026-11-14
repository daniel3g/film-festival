// Motor da trilha sonora do telão (Web Audio). Toca no painel (notebook).
// Cada momento usa o arquivo enviado pela escola; sem arquivo, toca um
// exemplo clássico gerado pelo próprio navegador (o mesmo da prévia).
import type { Cue } from "@/lib/telao";

export const CUES: Record<Cue, { name: string; moment: string; loop: boolean; next?: Cue; fadeIn?: number; example: string }> = {
  abertura: { name: "Abertura", moment: "Abertura da cerimônia", loop: false, next: "ambiente", example: "Fanfarra de metais" },
  bastidores: { name: "Bastidores", moment: "Chamada para votação e fila", loop: true, example: "Valsa de orquestra" },
  ambiente: { name: "Ambiente", moment: "Entre os prêmios e na entrega do troféu", loop: true, example: "Cordas suaves e harpa" },
  suspense: { name: "Suspense", moment: "Indicados", loop: true, fadeIn: 2.5, example: "Rufar de tambores e cordas graves" },
  fanfarra: { name: "Vencedor", moment: "Revelação do vencedor (júri)", loop: false, next: "ambiente", example: "Fanfarra curta com tímpano" },
  fanfarra_pc: { name: "Vencedor People's Choice", moment: "Clímax: People's Choice", loop: false, next: "ambiente", example: "Fanfarra épica com pratos" },
  encerramento: { name: "Encerramento", moment: "Encerramento", loop: true, example: "Tema orquestral lento" },
};
export const CUE_ORDER = Object.keys(CUES) as Cue[];

type Playing = { cue: Cue; bus: GainNode; timers: ReturnType<typeof setTimeout>[]; el: HTMLAudioElement | null; source: "arquivo" | "exemplo" };

/** De onde vem o áudio de cada faixa (URL local/remota) ou null para usar o exemplo. */
export type CueResolver = (cue: Cue) => Promise<string | null>;

export class Soundtrack {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private cur: Playing | null = null;
  private wanted: Cue | null = null;
  private listeners = new Set<() => void>();
  muted = false;
  volume = 0.7;

  constructor(private resolve: CueResolver) {}

  get ready() {
    return !!this.ctx && this.ctx.state === "running";
  }
  get current() {
    return this.cur ? { cue: this.cur.cue, source: this.cur.source } : null;
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }
  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  /** Precisa ser chamado num gesto do usuário (clique/tecla): política de autoplay. */
  unlock() {
    if (!this.ctx) {
      const ctx = new AudioContext();
      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : this.volume;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp);
      comp.connect(ctx.destination);
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.ctx = ctx;
      this.master = master;
      this.noise = buf;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume().then(() => this.emit());
    if (this.wanted && !this.cur) void this.play(this.wanted);
    this.emit();
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.ramp(m ? 0 : this.volume);
    this.emit();
  }
  setVolume(v: number) {
    this.volume = v;
    if (!this.muted) this.ramp(v);
    this.emit();
  }
  private ramp(v: number) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const g = this.master.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(v, t + 0.3);
  }

  /** Troca para a faixa do momento (crossfade). null = silêncio. */
  async play(cue: Cue | null, opts: { preview?: boolean } = {}) {
    this.wanted = cue;
    if (!this.ctx || !this.master) return; // toca quando destravar
    if (this.cur && this.cur.cue === cue) return;
    this.stop(1.2);
    if (!cue) return this.emit();

    const ctx = this.ctx;
    const info = CUES[cue];
    const bus = ctx.createGain();
    const t = ctx.currentTime + 0.05;
    bus.gain.setValueAtTime(0.0001, t);
    bus.gain.linearRampToValueAtTime(1, t + (info.fadeIn ?? 0.4));
    bus.connect(this.master);

    const playing: Playing = { cue, bus, timers: [], el: null, source: "exemplo" };
    this.cur = playing;
    const after = () => {
      if (this.cur !== playing) return;
      if (opts.preview) this.stop(1);
      else if (info.next) void this.play(info.next);
    };

    const url = await this.resolve(cue).catch(() => null);
    if (this.cur !== playing) return; // trocou enquanto resolvia

    if (url) {
      const el = new Audio();
      if (!url.startsWith("blob:")) el.crossOrigin = "anonymous";
      el.src = url;
      el.loop = info.loop;
      ctx.createMediaElementSource(el).connect(bus);
      el.onended = after;
      playing.el = el;
      playing.source = "arquivo";
      el.play().catch(() => {
        // arquivo com problema: usa o exemplo
        playing.el = null;
        playing.source = "exemplo";
        this.runSynth(playing, t, info.loop, after);
        this.emit();
      });
    } else {
      this.runSynth(playing, t, info.loop, after);
    }
    if (opts.preview) playing.timers.push(setTimeout(() => this.cur === playing && this.stop(1.5), 15000));
    this.emit();
  }

  private runSynth(p: Playing, t0: number, loop: boolean, after: () => void) {
    const ctx = this.ctx!;
    const run = (start: number) => {
      if (this.cur !== p) return;
      const len = SYNTH[p.cue](this.voices(p.bus), start);
      const ms = (start + len - ctx.currentTime) * 1000;
      p.timers.push(loop ? setTimeout(() => run(start + len), ms - 300) : setTimeout(after, ms - 600));
    };
    run(t0);
  }

  stop(fade = 1.2) {
    const p = this.cur;
    if (!p || !this.ctx) return;
    this.cur = null;
    p.timers.forEach(clearTimeout);
    const t = this.ctx.currentTime;
    const g = p.bus.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0, t + fade);
    setTimeout(() => {
      p.bus.disconnect();
      p.el?.pause();
    }, fade * 1000 + 600);
    this.emit();
  }

  dispose() {
    this.stop(0.2);
    setTimeout(() => void this.ctx?.close(), 1000);
  }

  // ---------------------------------------------------------------- síntese
  private voices(bus: GainNode): Voices {
    const ctx = this.ctx!;
    const noise = this.noise!;
    const vo: Voices["vo"] = (t, m, d, o) => {
      const g = ctx.createGain();
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = o.cut ?? 2000;
      const v = o.v ?? 0.1,
        a = o.a ?? 0.02,
        r = o.r ?? 0.2;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(v, t + a);
      if (o.dec) g.gain.setTargetAtTime(v * 0.15, t + a, o.dec);
      g.gain.setTargetAtTime(0, t + d, r / 3);
      f.connect(g);
      g.connect(bus);
      for (const dt of o.det ?? [0]) {
        const s = ctx.createOscillator();
        s.type = o.w ?? "sawtooth";
        s.frequency.value = 440 * Math.pow(2, (m - 69) / 12);
        s.detune.value = dt;
        s.connect(f);
        s.start(t);
        s.stop(t + d + r + 0.2);
      }
    };
    const nz: Voices["nz"] = (t, d, o) => {
      const s = ctx.createBufferSource();
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      s.buffer = noise;
      f.type = o.type ?? "bandpass";
      f.frequency.value = o.f ?? 2000;
      g.gain.setValueAtTime(o.v ?? 0.05, t);
      g.gain.exponentialRampToValueAtTime(0.0005, t + d);
      s.connect(f);
      f.connect(g);
      g.connect(bus);
      s.start(t, Math.random() * 0.5);
      s.stop(t + d + 0.05);
    };
    return { vo, nz, chord: (t, ms, d, o) => ms.forEach((m) => vo(t, m, d, o)) };
  }
}

// ------------------------------------------------------------------ partituras de exemplo

type Opt = { w?: OscillatorType; det?: number[]; cut?: number; a?: number; v?: number; r?: number; dec?: number };
type Voices = {
  vo: (t: number, midi: number, dur: number, o: Opt) => void;
  nz: (t: number, dur: number, o: { type?: BiquadFilterType; f?: number; v?: number }) => void;
  chord: (t: number, midis: number[], dur: number, o: Opt) => void;
};

const BR: Opt = { w: "sawtooth", det: [-7, 7], cut: 1700, a: 0.03, v: 0.045, r: 0.25 };
const ST: Opt = { w: "sawtooth", det: [-9, 0, 9], cut: 950, a: 0.7, v: 0.022, r: 1.2 };
const PN: Opt = { w: "triangle", a: 0.005, dec: 0.35, v: 0.11, cut: 3200, r: 0.5 };
const FL: Opt = { w: "sine", a: 0.06, v: 0.09, r: 0.25, cut: 4000 };
const TI: Opt = { w: "sine", a: 0.005, dec: 0.4, v: 0.4, cut: 600, r: 0.8 };

function fanfare({ vo, nz, chord }: Voices, t: number, tr: number, big: boolean) {
  const T = (a: number[]) => a.map((m) => m + tr);
  const C = T([60, 64, 67]);
  [0, 0.17, 0.34].forEach((x) => chord(t + x, C, 0.12, BR));
  chord(t + 0.5, C, 0.9, BR);
  vo(t, 36 + tr, 1, TI);
  [1.5, 1.67, 1.84].forEach((x) => chord(t + x, C, 0.12, BR));
  chord(t + 2, T([60, 65, 69]), 0.9, BR);
  vo(t + 2, 41 + tr, 1, TI);
  chord(t + 3, T([62, 67, 71]), 0.9, BR);
  vo(t + 3, 43 + tr, 1, TI);
  const end = big ? 5 : 4;
  if (big) {
    chord(t + 4, T([62, 67, 71, 74]), 0.9, BR);
    [4, 4.25, 4.5, 4.75].forEach((x) => vo(t + x, 43 + tr, 0.25, TI));
  }
  chord(t + end, T([64, 67, 72, 76]), 2.6, BR);
  chord(t + end, T([48, 55, 64]), 3, ST);
  vo(t + end, 36 + tr, 2, TI);
  if (big) nz(t + end, 3, { type: "highpass", f: 6000, v: 0.12 });
  return end + 3.2;
}

/** Cada função agenda as notas a partir de t e devolve a duração em segundos. */
const SYNTH: Record<Cue, (v: Voices, t: number) => number> = {
  abertura: (v, t) => fanfare(v, t, 0, false),
  fanfarra_pc: (v, t) => fanfare(v, t, 2, true),
  fanfarra: ({ vo, nz, chord }, t) => {
    [0, 0.15, 0.3].forEach((x) => chord(t + x, [60, 64, 67], 0.1, BR));
    chord(t + 0.45, [64, 67, 72, 76], 2.4, BR);
    chord(t + 0.45, [48, 55, 64], 2.8, ST);
    vo(t + 0.45, 36, 1.5, TI);
    nz(t + 0.45, 1.8, { type: "highpass", f: 7000, v: 0.06 });
    return 3.4;
  },
  bastidores: ({ vo, chord }, t) => {
    const q = 0.5;
    const bars: [number, number[]][] = [
      [48, [60, 64, 67]], [45, [57, 60, 64]], [50, [57, 62, 65]], [43, [55, 59, 65]],
      [48, [60, 64, 67]], [45, [57, 60, 64]], [43, [55, 59, 65]], [48, [60, 64, 67]],
    ];
    bars.forEach(([bs, ch], i) => {
      const t0 = t + i * 3 * q;
      vo(t0, bs, 0.9, { ...PN, v: 0.13 });
      chord(t0 + q, ch, 0.3, { ...PN, v: 0.045 });
      chord(t0 + 2 * q, ch, 0.3, { ...PN, v: 0.045 });
      chord(t0, ch.map((m) => m - 12), 3 * q, { ...ST, v: 0.012, a: 0.3 });
    });
    const melody: [number, number, number][] = [
      [76, 0, 2], [79, 2, 1], [81, 3, 2], [76, 5, 1], [77, 6, 1], [76, 7, 1], [74, 8, 1], [71, 9, 2], [74, 11, 1],
      [72, 12, 2], [76, 14, 1], [81, 15, 1], [79, 16, 1], [76, 17, 1], [77, 18, 1], [74, 19, 1], [71, 20, 1], [72, 21, 3],
    ];
    melody.forEach(([m, s, l]) => vo(t + s * q, m, l * q * 0.9, FL));
    return 24 * q;
  },
  ambiente: ({ vo, chord }, t) => {
    [[48, 55, 64, 71], [45, 52, 60, 67], [41, 48, 57, 64], [43, 50, 59, 64]].forEach((ch, i) => {
      const t0 = t + i * 4;
      chord(t0, ch, 4, { ...ST, a: 1.2, r: 1.6 });
      ch.slice(1).forEach((m, k) => vo(t0 + k * 0.25, m + 12, 1.5, { ...PN, v: 0.035 }));
    });
    return 16;
  },
  suspense: ({ vo, nz, chord }, t) => {
    chord(t, [38, 45, 53], 4, { ...ST, v: 0.04, a: 0.3, r: 0.4 });
    vo(t, 38, 1.2, { ...TI, v: 0.25 });
    for (let x = 0; x < 4; x += 0.065) nz(t + x, 0.05, { f: 1800, v: 0.04 + (0.05 * x) / 4 });
    return 4;
  },
  encerramento: ({ vo, chord }, t) => {
    let x = 0;
    const seq: [number[], number][] = [
      [[48, 60, 64, 67], 2], [[47, 59, 62, 67], 2], [[45, 57, 60, 64], 2], [[41, 57, 60, 65], 2],
      [[43, 55, 64, 72], 2], [[43, 55, 62, 71], 2], [[36, 48, 60, 64, 67, 72], 4],
    ];
    for (const [ch, d] of seq) {
      chord(t + x, ch, d, { ...ST, a: 0.4, r: 1 });
      vo(t + x, ch[ch.length - 1] + 12, d * 0.9, { ...BR, v: 0.03, a: 0.15 });
      x += d;
    }
    vo(t + 12, 36, 2, TI);
    return 16;
  },
};
