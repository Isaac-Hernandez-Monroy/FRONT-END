"use client";

import { useMemo, useRef, useState } from "react";
import ReCAPTCHA from "react-google-recaptcha";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";const ITEMS_PER_PAGE = 10;
const MIN_LOADING_TIME = 1200;

export default function Home() {
  const [view, setView] = useState("home");
  const [mode, setMode] = useState("url");

  const [input, setInput] = useState("");
  const [titleInput, setTitleInput] = useState("");

  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedNews, setSelectedNews] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const controllerRef = useRef(null);

  const [captchaToken, setCaptchaToken] = useState("");
  const captchaRef = useRef(null);

  const normalizeSearch = (value) =>
    String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  const filteredHistory = useMemo(() => {
    const query = normalizeSearch(historySearch);

    if (!query) return history;

    return history.filter((item) => {
      const searchable = normalizeSearch(
        `${item.texto_original || ""} ${item.etiqueta || ""} ${
          item.fuente_url || ""
        }`
      );

      return searchable.includes(query);
    });
  }, [history, historySearch]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredHistory.length / ITEMS_PER_PAGE)
  );

  const paginatedHistory = filteredHistory.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleTopbarClick = async () => {
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (view === "history") {
      setCurrentPage(1);
      await loadHistory();
    }
  };

  const handleGoHome = () => {
  setView("home");
  setSelectedNews(null);
  setResult(null);
  setError("");
  window.scrollTo({ top: 0, behavior: "smooth" });
};

  const handleGoHistory = async () => {
  setView("history");
  setSelectedNews(null);
  setDetailError("");
  setResult(null);
  setCurrentPage(1);
  await loadHistory();
  window.scrollTo({ top: 0, behavior: "smooth" });
};

  const loadHistory = async () => {
    setHistoryLoading(true);
    setHistoryError("");

    try {
      const response = await fetch(`${API_BASE}/history`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "No fue posible cargar el historial.");
      }

      setHistory(data);
    } catch (err) {
      setHistoryError(err.message || "Error cargando historial.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadNewsDetail = async (idNoticia) => {
    setView("detail");
    setDetailLoading(true);
    setDetailError("");
    setSelectedNews(null);

    try {
      const response = await fetch(`${API_BASE}/history/${idNoticia}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "No fue posible cargar la noticia.");
      }

      setSelectedNews(data);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setDetailError(err.message || "Error cargando noticia.");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAnalyze = async () => {
    setError("");
    setResult(null);

    const value = input.trim();
    const titleValue = titleInput.trim();

    if (mode === "url" && !value) {
      setError("Ingresa una URL para analizar.");
      return;
    }

    if (mode === "text" && !titleValue) {
      setError("Ingresa el título de la noticia.");
      return;
    }

    if (mode === "text" && !value) {
      setError("Ingresa el cuerpo de la noticia.");
      return;
    }

    if (!captchaToken) {
      setError("Completa el reCAPTCHA antes de analizar.");
      return;
    }
    const body =
      mode === "url"
        ? { url: value, title: null, text: null, captcha_token: captchaToken }
        : { url: null, title: titleValue, text: value, captcha_token: captchaToken };

    setInput("");
    setTitleInput("");
    console.log("API_BASE:", API_BASE);
    console.log("URL final:", `${API_BASE}/analyze`);
    const controller = new AbortController();
    controllerRef.current = controller;
    const loadingStart = Date.now();
    try {
  setLoading(true);

  const response = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    mode: "cors",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "ngrok-skip-browser-warning": "true",
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "No fue posible analizar la noticia.");
  }

  const elapsed = Date.now() - loadingStart;
  const remainingTime = Math.max(0, MIN_LOADING_TIME - elapsed);

  setTimeout(() => {
    setResult(data);
    setCaptchaToken("");
    captchaRef.current?.reset();
    setLoading(false);
    controllerRef.current = null;
  }, remainingTime);

  return;

} catch (err) {
  if (err.name === "AbortError") {
    setError("Análisis cancelado.");
  } else {
    setError(err.message || "Error de conexión con backend.");
  }

  setLoading(false);
  controllerRef.current = null;
}
  };
  const handleCancel = () => {
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
  };

  const getPredictionText = (prediction) => {
    if (prediction === 1) return "Verdadero";
    if (prediction === 0) return "Falso";
    return "Sin resultado";
  };

  const getPredictionColor = (prediction) => {
    if (prediction === 1) return "true-text";
    if (prediction === 0) return "false-text";
    return "";
  };

  const formatPercent = (value) => {
    const numberValue = Number(value);

    if (Number.isNaN(numberValue)) {
      return "0.00%";
    }

    return `${(numberValue * 100).toFixed(2)}%`;
  };

  const getPreviewTitle = (item) => {
    const text = item.texto_original || "";
    const firstSentence = text.split(".")[0];

    if (!firstSentence) {
      return `NOTICIA ${item.id_noticia}`;
    }

    return firstSentence.toUpperCase();
  };

  const getPreviewText = (text) => {
    if (!text) return "";
    return text.length > 180 ? text.substring(0, 180) + "..." : text;
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar-icons">
          <button
            type="button"
            className="icon-button"
            onClick={handleGoHome}
            title="Inicio"
          >
            🏠
          </button>

          <button
            type="button"
            className="icon-button"
            onClick={handleGoHistory}
            title="Historial"
          >
            📋
          </button>
        </div>

        <button
          type="button"
          className="topbar-title"
          onClick={handleTopbarClick}
          title="Volver arriba"
        >
          Sistema de clasificación
        </button>
      </header>

      {view === "home" && (
        <section className="content">
          <section className="input-card">
            <div className="tabs">
              <button
                type="button"
                onClick={() => {
                  setMode("url");
                  setResult(null);
                  setError("");
                }}
                className={mode === "url" ? "tab active" : "tab"}
              >
                URL
              </button>

              <button
                type="button"
                onClick={() => {
                setMode("text");
                setResult(null);
                setError("");
              }}
                className={mode === "text" ? "tab active" : "tab"}
              >
                Texto
              </button>
            </div>

            {mode === "url" ? (
              <input
                className="news-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Pega la URL de la noticia"
              />
            ) : (
              <div className="manual-news-fields">
                <input
                  className="news-title-input"
                  value={titleInput}
                  onChange={(event) => setTitleInput(event.target.value)}
                  placeholder="Título de la noticia"
                />

                <textarea
                  className="news-textarea"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Texto completo de la noticia"
                />
              </div>
            )}
            <div className="captcha-box">
              <ReCAPTCHA
                ref={captchaRef}
                sitekey="6LcipP4sAAAAANscl9dac5Lxt38pSUd2S-4gAwyC"
                onChange={(token) => setCaptchaToken(token || "")}
                onExpired={() => setCaptchaToken("")}
              />
            </div>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={loading}
              className="analyze-button"
            >
              Analizar
            </button>

            {error && <p className="error-message">{error}</p>}
          </section>

          <section className="result-card">
            <h2>Resultado de análisis</h2>

            {result ? (
              <>
                <div className="result-main">
                  <span
                    className={
                      result.sNPrediccion === 1
                        ? "result-icon true"
                        : "result-icon false"
                    }
                  >
                    {result.sNPrediccion === 1 ? "✓" : "✕"}
                  </span>

                  <span
                    className={`result-label ${getPredictionColor(
                      result.sNPrediccion
                    )}`}
                  >
                    {getPredictionText(result.sNPrediccion)}
                  </span>
                </div>

                <div className="result-details">
                  <p>
                    Confianza:{" "}
                    <strong>{formatPercent(result.sFConfianza)}</strong>
                  </p>

                  <p>
                    Falso: <strong>{formatPercent(result.sFFalse)}</strong>
                  </p>

                  <p>
                    Verdadero:{" "}
                    <strong>{formatPercent(result.sFTrue)}</strong>
                  </p>
                </div>
              </>
            ) : (
              <div className="empty-result">
                <span className="result-icon idle">?</span>
                <span className="empty-text">Sin análisis</span>
              </div>
            )}
          </section>
        </section>
      )}

      {view === "history" && (
        <section className="history-content">
          <div className="history-tools">
            <div className="search-box">
              <span className="search-icon">🔎</span>

              <input
                className="history-search"
                value={historySearch}
                onChange={(event) => {
                  setHistorySearch(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Buscar noticia analizada..."
              />

              {historySearch && (
                <button
                  type="button"
                  className="clear-search"
                  onClick={() => {
                    setHistorySearch("");
                    setCurrentPage(1);
                  }}
                  title="Limpiar búsqueda"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {historyLoading && (
            <p className="history-message">Cargando historial...</p>
          )}

          {historyError && <p className="error-message">{historyError}</p>}

          {!historyLoading && filteredHistory.length === 0 && (
            <p className="history-message">No se encontraron noticias.</p>
          )}

          <div className="history-list">
            {paginatedHistory.map((item) => {
              const prediction = item.etiqueta === "Verdadera" ? 1 : 0;

              return (
                <button
                  type="button"
                  key={item.id_noticia}
                  className="history-card"
                  onClick={() => loadNewsDetail(item.id_noticia)}
                >
                  <div className="history-info">
                    <h2 title={getPreviewTitle(item)}>
                      {getPreviewTitle(item)}
                    </h2>

                    <p>{getPreviewText(item.texto_original)}</p>
                  </div>

                  <div className="history-status">
                    <span
                      className={
                        prediction === 1
                          ? "result-icon true"
                          : "result-icon false"
                      }
                    >
                      {prediction === 1 ? "✓" : "✕"}
                    </span>

                    <p
                      className={
                        prediction === 1
                          ? "history-label true-history-text"
                          : "history-label false-text"
                      }
                    >
                      {prediction === 1 ? "Verdadero" : "Falso"}
                    </p>

                    <p className="history-confidence">
                      {formatPercent(item.confianza)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {filteredHistory.length > ITEMS_PER_PAGE && (
            <div className="pagination-wrapper">
              <div className="pagination-info">
                Página {currentPage} de {totalPages}
              </div>

              <div className="pagination">
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((page) => Math.max(1, page - 1))
                  }
                  disabled={currentPage === 1}
                >
                  Anterior
                </button>

                <button type="button" className="active-page">
                  {currentPage}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((page) => Math.min(totalPages, page + 1))
                  }
                  disabled={currentPage === totalPages}
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {view === "detail" && (
        <section className="history-content">
          {detailLoading && (
            <p className="history-message">Cargando noticia...</p>
          )}

          {detailError && <p className="error-message">{detailError}</p>}

          {selectedNews && (
            <article className="detail-card">
              <div className="detail-header">
                <div>
                  <h2>{getPreviewTitle(selectedNews)}</h2>
                  <p>{formatPercent(selectedNews.confianza)} de confianza</p>
                </div>

                <div className="history-status">
                  <span
                    className={
                      selectedNews.etiqueta === "Verdadera"
                        ? "result-icon true"
                        : "result-icon false"
                    }
                  >
                    {selectedNews.etiqueta === "Verdadera" ? "✓" : "✕"}
                  </span>

                  <p
                    className={
                      selectedNews.etiqueta === "Verdadera"
                        ? "history-label true-history-text"
                        : "history-label false-text"
                    }
                  >
                    {selectedNews.etiqueta}
                  </p>

                  <p className="history-confidence">
                    {formatPercent(selectedNews.confianza)}
                  </p>
                </div>
              </div>

              <div className="detail-text">
                <p>{selectedNews.texto_original}</p>
              </div>

              {selectedNews.fuente_url && (
                <a
                  className="original-link"
                  href={selectedNews.fuente_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Revisa la noticia original aquí
                </a>
              )}

              <button
                type="button"
                className="back-button"
                onClick={handleGoHistory}
              >
                Volver al historial
              </button>
            </article>
          )}
        </section>
      )}

      {loading && (
        <div className="loading-overlay">
          <div className="loading-modal">
            <div className="loading-title">Analizando</div>

            <div className="loading-body">
              <div className="progress-bar">
                <div className="progress-fill" />
              </div>

              <p>El sistema está analizando su noticia.</p>

              <button
                type="button"
                onClick={handleCancel}
                className="cancel-button"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}