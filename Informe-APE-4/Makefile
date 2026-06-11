# Nombre del archivo principal de LaTeX sin la extensión .tex
MAIN_FILE = APE4-Paredes_Steven

# Compilador LaTeX
LATEX_COMPILER = pdflatex

# Opciones de compilación
LATEX_OPTIONS = -interaction=nonstopmode -file-line-error

# Archivos auxiliares a limpiar
CLEAN_FILES = *.aux *.log *.toc *.lof *.lot *.bbl *.blg *.out *.nav *.snm *.vrb *.fls *.fdb_latexmk *.synctex.gz *.dvi *.ps *.bcf *.run.xml *.idx *.ind *.ilg *.ent *.gz

.PHONY: all clean view

all: $(MAIN_FILE).pdf

$(MAIN_FILE).pdf: $(MAIN_FILE).tex
	$(LATEX_COMPILER) $(LATEX_OPTIONS) $(MAIN_FILE).tex
	bibtex $(MAIN_FILE) # Procesar la bibliografía
	$(LATEX_COMPILER) $(LATEX_OPTIONS) $(MAIN_FILE).tex
	$(LATEX_COMPILER) $(LATEX_OPTIONS) $(MAIN_FILE).tex # Ejecutar dos veces más para resolver referencias y bibliografía

clean:
	rm -f $(CLEAN_FILES) $(MAIN_FILE).pdf

view: $(MAIN_FILE).pdf
	# Abre el PDF con el visor predeterminado del sistema
	# Ajusta este comando según tu sistema operativo (e.g., 'open' en macOS, 'xdg-open' en Linux, 'start' en Windows)
	xdg-open $(MAIN_FILE).pdf || open $(MAIN_FILE).pdf || start $(MAIN_FILE).pdf
