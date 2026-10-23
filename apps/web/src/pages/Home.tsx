import { Icon } from "../components/Icon";
import { services, faqs } from "../lib/content";

export function ConceptSite({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`concept-site ${compact ? "compact" : ""}`}
      aria-label="ตัวอย่างดีไซน์เว็บไซต์ ORBIT"
    >
      <div className="concept-nav">
        <b>
          orbit<span>®</span>
        </b>
        <span>Objects for everyday living</span>
        <span>↗</span>
      </div>
      <div className="concept-content">
        <div>
          <span className="concept-label">THE EVERYDAY COLLECTION</span>
          <h3>
            Less, but
            <br />
            <em>better.</em>
          </h3>
          <span className="concept-cta">Explore collection ↗</span>
        </div>
        <div className="sculpture" aria-hidden="true">
          <div className="sculpture-arch" />
          <div className="sculpture-sphere" />
          <div className="sculpture-plinth" />
        </div>
      </div>
      <div className="concept-foot">
        <span>01 / Thoughtful objects</span>
        <span>Designed to stay.</span>
      </div>
    </div>
  );
}
export function Home() {
  return (
    <>
      <section className="hero container">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="status-dot" /> INDEPENDENT DIGITAL STUDIO
          </span>
          <h1>
            จากไอเดียของคุณ
            <br />
            สู่สิ่งที่<span className="accent">ใช้งานได้จริง</span>
            <span className="hero-period">.</span>
          </h1>
          <p>
            เว็บไซต์ แอปพลิเคชัน และเกม
            <br className="desktop-only" />{" "}
            ที่ใส่ใจทั้งประสบการณ์และรายละเอียดของโค้ด
            <br className="desktop-only" /> คิดอย่างเป็นระบบ
            สร้างอย่างมีเป้าหมาย
          </p>
          <div className="hero-actions">
            <a href="/start" className="button">
              เริ่มโปรเจกต์ของคุณ <Icon name="northeast" />
            </a>
            <a href="/#work" className="button ghost">
              สำรวจแนวทางงาน <Icon name="arrow" />
            </a>
          </div>
          <div className="hero-note">
            <span className="mini-line" /> คุณเล่าเป้าหมาย เราช่วยวางทางไปถึง
          </div>
        </div>
        <div className="hero-art">
          <div className="orbit-line orbit-one" />
          <div className="orbit-line orbit-two" />
          <div className="art-cross cross-one">+</div>
          <div className="art-cross cross-two">+</div>
          <div className="hero-window">
            <div className="window-bar">
              <div className="window-dots">
                <i />
                <i />
                <i />
              </div>
              <span>orbit / website concept</span>
              <Icon name="lock" size={12} />
            </div>
            <ConceptSite compact />
            <div className="window-status">
              <span>
                <i className="tiny-dot" /> DESIGN EXPLORATION
              </span>
              <span>01 — WEB</span>
            </div>
          </div>
          <div className="floating-label label-code">
            <Icon name="code" />
            <div>
              Built with intention<small>DESIGN × ENGINEERING</small>
            </div>
          </div>
          <a href="/demo" className="floating-label label-portal">
            <span className="portal-symbol">
              <Icon name="grid" />
            </span>
            <div>
              ทุกขั้นตอน มองเห็นได้<small>ลองดูพื้นที่ลูกค้าตัวอย่าง</small>
            </div>
            <Icon name="northeast" size={16} />
          </a>
          <span className="art-caption">
            A CONCEPT BY AZELVORI · NOT A CLIENT PROJECT
          </span>
        </div>
      </section>
      <div className="expertise-strip">
        <div className="container">
          <span>IDEAS INTO EXPERIENCES</span>
          <span>
            Websites <i>↗</i>
          </span>
          <span>
            Web apps <i>↗</i>
          </span>
          <span>
            Games <i>↗</i>
          </span>
          <span>
            Better code <i>↗</i>
          </span>
        </div>
      </div>
      <section id="services" className="section container">
        <div className="section-heading">
          <div>
            <span className="eyebrow">01 / WHAT WE DO</span>
            <h2>
              เริ่มจากสิ่งที่คุณต้องการ
              <br />
              <span className="muted">สร้างให้เหมาะกับงานของคุณ</span>
            </h2>
          </div>
          <p>
            งานแต่ละแบบมีโจทย์ต่างกัน
            <br />
            เราจึงเริ่มจากความเข้าใจ ก่อนเริ่มเขียนโค้ด
          </p>
        </div>
        <div className="services-grid">
          {services.map((s, i) => (
            <a
              href={`/start?service=${s.id}`}
              className={`service-card service-${i}`}
              key={s.id}
            >
              <div className="service-top">
                <span className="service-icon">
                  <Icon name={s.icon} size={25} />
                </span>
                <span className="service-index">0{i + 1}</span>
              </div>
              <span className="eyebrow">{s.en}</span>
              <h3>{s.title}</h3>
              <p>{s.description}</p>
              <div className="service-bottom">
                <div className="tags">
                  {s.tags.map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
                <Icon name="northeast" />
              </div>
            </a>
          ))}
        </div>
      </section>
      <section id="work" className="section work-section">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">02 / POSSIBILITIES</span>
              <h2>มองเห็นความเป็นไปได้</h2>
            </div>
            <p>
              ตัวอย่างแนวทางดีไซน์ที่สร้างขึ้นเพื่อสาธิต
              <br />
              ยังไม่ใช่ผลงานลูกค้าหรือเคสที่ส่งมอบแล้ว
            </p>
          </div>
          <div className="work-grid">
            <a className="work-item" href="/demo">
              <div className="work-visual orbit-visual">
                <ConceptSite />
              </div>
              <div className="work-info">
                <div>
                  <span className="eyebrow">WEB DESIGN / CONCEPT</span>
                  <h3>ORBIT — Everyday, elevated.</h3>
                </div>
                <span className="round-arrow">
                  <Icon name="northeast" />
                </span>
              </div>
            </a>
            <a className="work-item" href="/start?service=GAME_NEW">
              <div className="work-visual game-visual">
                <span className="game-overline">AZELVORI / PLAY LAB</span>
                <div className="game-grid" aria-hidden="true" />
                <div className="game-artifact" aria-hidden="true">
                  <div />
                  <div />
                  <div />
                </div>
                <div className="game-visual-title">
                  <small>BUILD A WORLD OF YOUR OWN</small>
                  <strong>
                    WORLDS
                    <br />
                    IN THE MAKING<span>✦</span>
                  </strong>
                </div>
                <span className="game-concept-label">
                  VISUAL CONCEPT · NON-PLAYABLE
                </span>
              </div>
              <div className="work-info">
                <div>
                  <span className="eyebrow">GAME / ART DIRECTION</span>
                  <h3>พื้นที่สำหรับโลกใบใหม่ของคุณ</h3>
                </div>
                <span className="round-arrow">
                  <Icon name="northeast" />
                </span>
              </div>
            </a>
          </div>
        </div>
      </section>
      <section id="process" className="section container process-section">
        <div className="process-intro">
          <span className="eyebrow">03 / HOW WE WORK</span>
          <h2>
            ชัดเจนตั้งแต่บรีฟ
            <br />
            จนถึงส่งมอบ
          </h2>
          <p>
            รู้ว่ากำลังสร้างอะไร ตรวจรับจากอะไร
            <br />
            และขั้นตอนถัดไปคืออะไร
          </p>
          <a className="text-link" href="/demo">
            สำรวจพอร์ทัลตัวอย่าง <Icon name="arrow" />
          </a>
          <div className="process-note">
            <Icon name="shield" />
            <span>
              ใช้ AI ช่วยสร้าง
              <br />
              พร้อมกระบวนการตรวจงานก่อนส่งมอบ
            </span>
          </div>
        </div>
        <div className="process-list">
          {[
            [
              "01",
              "คุยเป้าหมาย วางขอบเขต",
              "เล่าไอเดีย เลือกประเภทงาน ระบุสิ่งที่ต้องการและข้อจำกัด เราร่วมกันทำให้โจทย์ชัด",
            ],
            [
              "02",
              "ตกลงแผนและราคา",
              "กำหนดงานส่งมอบ ระยะเวลา รอบแก้ไข และเกณฑ์ตรวจรับก่อนเริ่มงาน",
            ],
            [
              "03",
              "สร้าง ทดสอบ และตรวจงาน",
              "พัฒนาเป็นช่วงงาน พร้อมพรีวิวในรูปแบบที่เหมาะกับโปรเจกต์ รับความคิดเห็นตามขอบเขต",
            ],
            [
              "04",
              "ส่งมอบ พร้อมทางไปต่อ",
              "ตรวจรับเวอร์ชันสุดท้าย ส่งซอร์สและคู่มือตามข้อตกลง พร้อมเงื่อนไขดูแลที่ชัดเจน",
            ],
          ].map(([n, title, detail]) => (
            <div className="process-step" key={n}>
              <span>{n}</span>
              <div>
                <h3>{title}</h3>
                <p>{detail}</p>
              </div>
              <Icon name="northeast" />
            </div>
          ))}
        </div>
      </section>
      <section id="pricing" className="pricing-band">
        <div className="container">
          <Icon name="code" size={38} />
          <div>
            <span className="eyebrow">SCOPED TO YOUR AMBITION</span>
            <h2>ขนาดงานต่างกัน แผนก็ควรต่างกัน</h2>
            <p>
              ประเมินราคาหลังเข้าใจโจทย์ ไม่มีข้อผูกมัดจากการกรอกบรีฟ
              <br />
              งานวิเคราะห์บั๊ก งานพัฒนา และงานดูแล แยกขอบเขตให้ตรวจสอบได้
            </p>
          </div>
          <a href="/start" className="button secondary">
            ให้เราช่วยประเมิน <Icon name="arrow" />
          </a>
        </div>
      </section>
      <section id="faq" className="section container faq-section">
        <div>
          <span className="eyebrow">04 / GOOD TO KNOW</span>
          <h2>
            ก่อนเริ่ม
            <br />
            มีอะไรอยากรู้ไหม?
          </h2>
          <p>รวมคำตอบที่ช่วยให้เริ่มงานได้ชัดเจนขึ้น</p>
        </div>
        <div className="faq-list">
          {faqs.map(([q, a]) => (
            <details key={q}>
              <summary>
                {q}
                <span>+</span>
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="container closing-wrap">
        <div className="closing">
          <span className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span>
          <h2>
            ไอเดียถัดไปของคุณ
            <br />
            <span>เริ่มเป็นรูปเป็นร่างได้แล้ว</span>
          </h2>
          <a href="/start" className="button">
            เล่าโปรเจกต์ให้เราฟัง <Icon name="northeast" />
          </a>
          <span className="closing-asterisk" aria-hidden="true">
            ✳
          </span>
          <p>ใช้เวลาประมาณ 3–5 นาที · ยังไม่มีค่าใช้จ่ายจากการกรอกบรีฟ</p>
        </div>
      </section>
    </>
  );
}
