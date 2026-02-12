// Main entry point for the bookmaker race ledger application

// Storage Module
const StorageModule = {
    saveData: function (key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error('Error saving data', error);
        }
    },
    loadData: function (key) {
        try {
            return JSON.parse(localStorage.getItem(key));
        } catch (error) {
            console.error('Error loading data', error);
            return null;
        }
    },
    clearData: function (key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.error('Error clearing data', error);
        }
    }
};

// Session Module
const SessionModule = {
    startSession: function (userId) {
        this.currentSession = { userId: userId, startTime: new Date() };
        StorageModule.saveData('currentSession', this.currentSession);
    },
    endSession: function () {
        this.currentSession = null;
        StorageModule.clearData('currentSession');
    },
    getSessionData: function () {
        return StorageModule.loadData('currentSession');
    }
};

// Race Module
const RaceModule = {
    races: [],
    currentRaceId: 1,
    addRace: function (race) {
        const nextId = this.getNextRaceId();
        const newRace = {
            id: race?.id ?? nextId,
            name: race?.name ?? `Race ${nextId}`,
            ended: Boolean(race?.ended)
        };
        this.races.push(newRace);
        StorageModule.saveData('races', this.races);
        if (!this.currentRaceId && newRace.id) {
            this.currentRaceId = newRace.id;
            StorageModule.saveData('currentRaceId', this.currentRaceId);
        }
        return newRace;
    },
    getNextRaceId: function () {
        if (!this.races.length) {
            return 1;
        }
        return Math.max(...this.races.map(race => Number(race.id) || 0)) + 1;
    },
    getRaces: function () {
        const stored = StorageModule.loadData('races');
        if (stored) {
            this.races = stored;
        }
        return this.races;
    },
    ensureDefaultRace: function () {
        this.getRaces();
        if (!this.races.length) {
            this.addRace({ id: 1, name: 'Race 1', ended: false });
        }
        if (!this.currentRaceId) {
            this.setCurrentRace(this.races[0].id);
        }
        return this.currentRaceId;
    },
    setCurrentRace: function (raceId) {
        this.currentRaceId = raceId;
        StorageModule.saveData('currentRaceId', this.currentRaceId);
    },
    getCurrentRaceId: function () {
        const stored = StorageModule.loadData('currentRaceId');
        if (stored !== null && stored !== undefined && !Number.isNaN(Number(stored))) {
            this.currentRaceId = Number(stored);
        }
        return this.currentRaceId;
    },
    endRace: function (raceId) {
        this.races = this.races.map(race => (race.id === raceId ? { ...race, ended: true } : race));
        StorageModule.saveData('races', this.races);
    },
    deleteRace: function (raceId) {
        this.races = this.races.filter(race => race.id !== raceId);
        StorageModule.saveData('races', this.races);
        if (this.currentRaceId === raceId) {
            const fallback = this.races[0]?.id ?? null;
            this.currentRaceId = fallback;
            StorageModule.saveData('currentRaceId', this.currentRaceId);
        }
        return this.currentRaceId;
    }
};

// Horse Module
const HorseModule = {
    horses: [],
    addHorse: function (horse) {
        const currentRaceId = RaceModule.getCurrentRaceId();
        const normalizedHorse = {
            ...horse,
            raceId: horse.raceId ?? currentRaceId
        };
        this.horses.push(normalizedHorse);
        StorageModule.saveData('horses', this.horses);
    },
    updateHorseName: function (horseId, name) {
        const horse = this.horses.find(item => item.id === horseId);
        if (horse) {
            horse.name = name;
            StorageModule.saveData('horses', this.horses);
        }
    },
    getHorses: function () {
        const stored = StorageModule.loadData('horses');
        if (stored) {
            this.horses = stored;
        }
        return this.horses;
    },
    getHorsesForRace: function (raceId) {
        const horses = this.getHorses();
        let needsSave = false;
        const normalized = horses.map(horse => {
            if (horse.raceId === undefined || horse.raceId === null) {
                needsSave = true;
                return { ...horse, raceId: raceId };
            }
            return horse;
        });
        if (needsSave) {
            this.horses = normalized;
            StorageModule.saveData('horses', normalized);
        }
        return normalized.filter(horse => horse.raceId === raceId);
    },
    removeHorsesForRace: function (raceId) {
        this.horses = this.getHorses().filter(horse => horse.raceId !== raceId);
        StorageModule.saveData('horses', this.horses);
    }
};

// Bet Module
const BetModule = {
    bets: [],
    addBet: function (bet) {
        this.bets.push(bet);
        StorageModule.saveData('bets', this.bets);
    },
    removeBet: function (betId) {
        this.bets = this.bets.filter(bet => bet.id !== betId);
        StorageModule.saveData('bets', this.bets);
    },
    persist: function () {
        StorageModule.saveData('bets', this.bets);
    },
    getBets: function () {
        const stored = StorageModule.loadData('bets');
        if (stored) {
            this.bets = stored;
        }
        const currentRaceId = RaceModule.getCurrentRaceId();
        let needsSave = false;
        this.bets = this.bets.map(bet => {
            if (bet.raceId === undefined || bet.raceId === null) {
                needsSave = true;
                return { ...bet, raceId: currentRaceId };
            }
            return bet;
        });
        if (needsSave) {
            StorageModule.saveData('bets', this.bets);
        }
        return this.bets;
    },
    getBetsForHorseCategory: function (horseId, category) {
        const currentRaceId = RaceModule.getCurrentRaceId();
        return this.getBets().filter(bet => bet.horseId === horseId && bet.category === category && bet.raceId === currentRaceId);
    },
    createEmptyBet: function (horseId, category) {
        return {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            horseId: horseId,
            category: category,
            raceId: RaceModule.getCurrentRaceId(),
            customer: '',
            type: 'Cash',
            odds: '',
            amount: '',
            payout: ''
        };
    },
    removeBetsForRace: function (raceId) {
        this.bets = this.getBets().filter(bet => bet.raceId !== raceId);
        StorageModule.saveData('bets', this.bets);
    }
};

// Tax Module
const TaxModule = {
    calculateTax: function (amount) {
        const taxRate = 0.15; // Example tax rate
        return amount * taxRate;
    }
};

// Calculation Module
const CalculationModule = {
    calculateTotal: function (bets) {
        return bets.reduce((total, bet) => total + (parseFloat(bet.amount) || 0), 0);
    }
};

// Settlement Module
const SettlementModule = {
    isWinningBet: function (bet, results) {
        if (!results) {
            return false;
        }
        if (bet.category === 'win') {
            return bet.horseId === results.first;
        }
        if (bet.category === 'place') {
            return [results.first, results.second, results.third].includes(bet.horseId);
        }
        return false;
    },
    calculatePayoutAmount: function (bet, oddsValue, amountValue, isWinner) {
        if (!Number.isFinite(oddsValue) || !Number.isFinite(amountValue)) {
            return 0;
        }
        const tax = TaxModule.calculateTax(amountValue);
        if (bet.type === 'Cash') {
            return isWinner ? (oddsValue * amountValue) + amountValue : 0;
        }
        if (bet.type === 'Credit') {
            return isWinner ? (oddsValue * amountValue) - tax : amountValue + tax;
        }
        return 0;
    },
    settleBets: function (bets, results) {
        return bets.map(bet => {
            const isWinner = this.isWinningBet(bet, results);
            const oddsValue = parseFloat(bet.odds);
            const amountValue = parseFloat(bet.amount);
            const payoutValue = this.calculatePayoutAmount(bet, oddsValue, amountValue, isWinner);
            return {
                ...bet,
                settled: true,
                isWinner: isWinner,
                payout: Number.isFinite(payoutValue) ? payoutValue.toFixed(2) : '0.00'
            };
        });
    }
};

// Summary Module
const SummaryModule = {
    generateSummary: function () {
        const totalBets = CalculationModule.calculateTotal(BetModule.getBets());
        const totalTax = TaxModule.calculateTax(totalBets);
        return {
            totalBets: totalBets,
            totalTax: totalTax
        };
    }
};

// UI Module
const UIModule = {
    render: function () {
        RaceModule.ensureDefaultRace();
        this.renderRaceTabs();
        this.updateRaceDisplays();
        this.renderBetTables();
    },
    renderRaceTabs: function () {
        const tabs = document.getElementById('race-tabs');
        if (!tabs) {
            return;
        }
        const currentRaceId = RaceModule.getCurrentRaceId();
        const races = RaceModule.getRaces();
        tabs.innerHTML = '';
        races.forEach(race => {
            const tab = document.createElement('button');
            tab.type = 'button';
            tab.className = 'race-tab';
            if (race.id === currentRaceId) {
                tab.classList.add('active');
            }
            if (race.ended) {
                tab.classList.add('ended');
            }
            tab.textContent = race.name || `Race ${race.id}`;
            tab.dataset.raceId = race.id;
            tab.addEventListener('click', () => {
                this.switchRace(race.id);
            });
            tabs.appendChild(tab);
        });
    },
    updateRaceDisplays: function () {
        const currentRaceId = RaceModule.getCurrentRaceId();
        const labels = ['current-race-number', 'bet-race-number', 'settlement-race-number'];
        labels.forEach(id => {
            const label = document.getElementById(id);
            if (label) {
                label.textContent = currentRaceId;
            }
        });
    },
    clearSettlementInputs: function () {
        const fields = ['first-place', 'second-place', 'third-place'];
        fields.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.value = '';
            }
        });
        const resultsContainer = document.getElementById('settlement-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = '';
        }
    },
    switchRace: function (raceId) {
        RaceModule.setCurrentRace(raceId);
        this.updateRaceDisplays();
        this.renderRaceTabs();
        this.renderBetTables();
        this.clearSettlementInputs();
        this.focusFirstBetCell();
    },
    handleRaceControls: function () {
        const addRaceBtn = document.getElementById('add-race-btn');
        const endRaceBtn = document.getElementById('end-race-btn');
        const deleteRaceBtn = document.getElementById('delete-race-btn');

        if (addRaceBtn) {
            addRaceBtn.addEventListener('click', () => {
                const race = RaceModule.addRace({});
                this.switchRace(race.id);
            });
        }

        if (endRaceBtn) {
            endRaceBtn.addEventListener('click', () => {
                const currentRaceId = RaceModule.getCurrentRaceId();
                RaceModule.endRace(currentRaceId);
                this.renderRaceTabs();
            });
        }

        if (deleteRaceBtn) {
            deleteRaceBtn.addEventListener('click', () => {
                const currentRaceId = RaceModule.getCurrentRaceId();
                HorseModule.removeHorsesForRace(currentRaceId);
                BetModule.removeBetsForRace(currentRaceId);
                RaceModule.deleteRace(currentRaceId);
                const nextRaceId = RaceModule.ensureDefaultRace();
                this.switchRace(nextRaceId);
            });
        }
    },
    renderBetTables: function () {
        const container = document.getElementById('bet-entry-sections');
        if (!container) {
            return;
        }

        const currentRaceId = RaceModule.getCurrentRaceId();
        const horses = HorseModule.getHorsesForRace(currentRaceId);

        container.innerHTML = '';

        if (!horses.length) {
            const emptyState = document.createElement('p');
            emptyState.className = 'empty-state';
            emptyState.textContent = 'Add horses to start entering bets.';
            container.appendChild(emptyState);
            return;
        }

        horses.forEach(horse => {
            container.appendChild(this.createHorseBetSection(horse));
        });

        this.focusFirstBetCell();
    },
    createHorseBetSection: function (horse) {
        const section = document.createElement('div');
        section.className = 'horse-bet-section';
        section.dataset.horseId = horse.id;

        const header = document.createElement('button');
        header.type = 'button';
        header.className = 'horse-bet-header';
        header.setAttribute('aria-expanded', 'true');

        const title = document.createElement('div');
        title.className = 'horse-bet-title';
        title.textContent = `Horse #${horse.id}`;

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'horse-name-input';
        nameInput.placeholder = 'Optional horse name';
        nameInput.value = horse.name || '';
        nameInput.addEventListener('input', (event) => {
            event.stopPropagation();
            HorseModule.updateHorseName(horse.id, nameInput.value);
        });
        nameInput.addEventListener('click', event => event.stopPropagation());

        const indicator = document.createElement('span');
        indicator.className = 'horse-accordion-indicator';
        indicator.textContent = '▾';

        header.appendChild(title);
        header.appendChild(nameInput);
        header.appendChild(indicator);

        const content = document.createElement('div');
        content.className = 'horse-bet-content';

        content.appendChild(this.createBetTableSection(horse, 'win', 'Win Bets'));
        content.appendChild(this.createBetTableSection(horse, 'place', 'Place Bets'));

        header.addEventListener('click', () => {
            const isExpanded = header.getAttribute('aria-expanded') === 'true';
            header.setAttribute('aria-expanded', String(!isExpanded));
            section.classList.toggle('collapsed', isExpanded);
        });

        section.appendChild(header);
        section.appendChild(content);

        return section;
    },
    createBetTableSection: function (horse, category, label) {
        const wrapper = document.createElement('div');
        wrapper.className = 'horse-bet-table';

        const heading = document.createElement('h4');
        heading.className = 'bet-table-title';
        heading.textContent = label;
        wrapper.appendChild(heading);

        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'table-wrapper';

        const table = document.createElement('table');
        table.className = 'bet-table';
        table.dataset.horseId = horse.id;
        table.dataset.betCategory = category;

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        ['Customer', 'Type', 'Odds', 'Amount', 'Payout', 'Actions'].forEach(title => {
            const th = document.createElement('th');
            th.textContent = title;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        let bets = BetModule.getBetsForHorseCategory(horse.id, category);
        if (!bets.length) {
            const newBet = BetModule.createEmptyBet(horse.id, category);
            BetModule.addBet(newBet);
            bets = [newBet];
        }

        bets.forEach(bet => {
            tbody.appendChild(this.createBetRow(bet));
        });

        table.appendChild(tbody);
        tableWrapper.appendChild(table);
        wrapper.appendChild(tableWrapper);

        return wrapper;
    },
    createBetRow: function (bet) {
        const row = document.createElement('tr');
        row.dataset.betId = bet.id;

        const customerCell = document.createElement('td');
        const customerInput = document.createElement('input');
        customerInput.type = 'text';
        customerInput.placeholder = 'Customer name / card number';
        customerInput.value = bet.customer;
        customerInput.addEventListener('input', () => {
            bet.customer = customerInput.value;
            BetModule.persist();
        });
        customerCell.appendChild(customerInput);

        const typeCell = document.createElement('td');
        const typeSelect = document.createElement('select');
        ['Cash', 'Credit'].forEach(optionValue => {
            const option = document.createElement('option');
            option.value = optionValue;
            option.textContent = optionValue;
            typeSelect.appendChild(option);
        });
        typeSelect.value = bet.type;
        typeSelect.addEventListener('change', () => {
            bet.type = typeSelect.value;
            typeSelect.classList.toggle('bet-type-cash', bet.type === 'Cash');
            typeSelect.classList.toggle('bet-type-credit', bet.type === 'Credit');
            updatePayout();
        });
        typeSelect.dispatchEvent(new Event('change'));
        typeCell.appendChild(typeSelect);

        const oddsCell = document.createElement('td');
        const oddsInput = document.createElement('input');
        oddsInput.type = 'number';
        oddsInput.min = '0';
        oddsInput.step = '0.01';
        oddsInput.placeholder = 'Odds';
        oddsInput.value = bet.odds;

        const amountCell = document.createElement('td');
        const amountInput = document.createElement('input');
        amountInput.type = 'number';
        amountInput.min = '0';
        amountInput.step = '0.01';
        amountInput.placeholder = 'Amount';
        amountInput.value = bet.amount;

        const payoutCell = document.createElement('td');
        const payoutInput = document.createElement('input');
        payoutInput.type = 'text';
        payoutInput.placeholder = 'Payout';
        payoutInput.readOnly = true;
        payoutInput.value = bet.payout;

        const updatePayout = () => {
            const oddsValue = parseFloat(oddsInput.value);
            const amountValue = parseFloat(amountInput.value);
            if (Number.isFinite(oddsValue) && Number.isFinite(amountValue)) {
                const payoutValue = SettlementModule.calculatePayoutAmount(bet, oddsValue, amountValue, true);
                bet.payout = Number.isFinite(payoutValue) ? payoutValue.toFixed(2) : '';
            } else {
                bet.payout = '';
            }
            payoutInput.value = bet.payout;
            BetModule.persist();
        };

        oddsInput.addEventListener('input', () => {
            bet.odds = oddsInput.value;
            updatePayout();
        });

        amountInput.addEventListener('input', () => {
            bet.amount = amountInput.value;
            updatePayout();
        });

        updatePayout();

        oddsCell.appendChild(oddsInput);
        amountCell.appendChild(amountInput);
        payoutCell.appendChild(payoutInput);

        const actionsCell = document.createElement('td');
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'delete-bet-btn';
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => {
            BetModule.removeBet(bet.id);
            this.renderBetTables();
            this.focusTableFirstCell(bet.horseId, bet.category);
        });
        actionsCell.appendChild(deleteButton);

        row.appendChild(customerCell);
        row.appendChild(typeCell);
        row.appendChild(oddsCell);
        row.appendChild(amountCell);
        row.appendChild(payoutCell);
        row.appendChild(actionsCell);

        return row;
    },
    focusFirstBetCell: function () {
        const firstInput = document.querySelector('#bet-entry-sections table tbody tr td input, #bet-entry-sections table tbody tr td select');
        if (firstInput) {
            firstInput.focus();
            if (typeof firstInput.select === 'function') {
                firstInput.select();
            }
        }
    },
    focusTableFirstCell: function (horseId, category) {
        const table = document.querySelector(`table[data-horse-id="${horseId}"][data-bet-category="${category}"]`);
        if (!table) {
            return;
        }
        const firstInput = table.querySelector('tbody tr td input, tbody tr td select');
        if (firstInput) {
            firstInput.focus();
            if (typeof firstInput.select === 'function') {
                firstInput.select();
            }
        }
    },
    addBetRowForTable: function (table) {
        if (!table) {
            return null;
        }
        const tbody = table.querySelector('tbody');
        if (!tbody) {
            return null;
        }
        const horseId = parseInt(table.dataset.horseId, 10);
        const category = table.dataset.betCategory;
        const newBet = BetModule.createEmptyBet(horseId, category);
        BetModule.addBet(newBet);
        const newRow = this.createBetRow(newBet);
        tbody.appendChild(newRow);
        return newRow;
    },
    handleKeyboardNavigation: function () {
        const container = document.getElementById('bet-entry-sections');
        if (!container) {
            return;
        }

        container.addEventListener('keydown', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) {
                return;
            }

            const table = target.closest('table[data-bet-category]');
            if (!table) {
                return;
            }

            const cell = target.closest('td');
            const row = target.closest('tr');
            if (!cell || !row) {
                return;
            }

            const rows = Array.from(table.querySelectorAll('tbody tr'));
            const cells = Array.from(row.querySelectorAll('td'));
            const rowIndex = rows.indexOf(row);
            const cellIndex = cells.indexOf(cell);
            const lastCellIndex = cells.length - 1;

            const focusCell = (targetRowIndex, targetCellIndex) => {
                const targetRow = rows[targetRowIndex];
                if (!targetRow) {
                    return false;
                }
                const targetCells = Array.from(targetRow.querySelectorAll('td'));
                const targetCell = targetCells[targetCellIndex];
                if (!targetCell) {
                    return false;
                }
                const focusable = targetCell.querySelector('input, select, button');
                if (focusable) {
                    focusable.focus();
                    if (typeof focusable.select === 'function') {
                        focusable.select();
                    }
                    return true;
                }
                return false;
            };

            if (event.key === 'Enter') {
                event.preventDefault();
                if (cellIndex === lastCellIndex) {
                    const newRow = this.addBetRowForTable(table);
                    if (newRow) {
                        const firstCellInput = newRow.querySelector('input, select, button');
                        if (firstCellInput) {
                            firstCellInput.focus();
                            if (typeof firstCellInput.select === 'function') {
                                firstCellInput.select();
                            }
                        }
                    }
                } else {
                    focusCell(rowIndex, cellIndex + 1);
                }
                return;
            }

            if (event.key === 'ArrowRight') {
                event.preventDefault();
                focusCell(rowIndex, Math.min(cellIndex + 1, lastCellIndex));
                return;
            }

            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                focusCell(rowIndex, Math.max(cellIndex - 1, 0));
                return;
            }

            if (event.key === 'ArrowDown') {
                event.preventDefault();
                focusCell(Math.min(rowIndex + 1, rows.length - 1), cellIndex);
                return;
            }

            if (event.key === 'ArrowUp') {
                event.preventDefault();
                focusCell(Math.max(rowIndex - 1, 0), cellIndex);
            }
        });
    },
    handleSettlement: function () {
        const settleBtn = document.getElementById('settle-race-btn');
        if (!settleBtn) {
            return;
        }

        settleBtn.addEventListener('click', () => {
            const results = {
                first: parseInt(document.getElementById('first-place')?.value, 10),
                second: parseInt(document.getElementById('second-place')?.value, 10),
                third: parseInt(document.getElementById('third-place')?.value, 10)
            };

            const bets = BetModule.getBets();
            const settledBets = SettlementModule.settleBets(bets, results);
            BetModule.bets = settledBets;
            BetModule.persist();

            const resultsContainer = document.getElementById('settlement-results');
            if (!resultsContainer) {
                return;
            }

            resultsContainer.innerHTML = '';
            settledBets.forEach(bet => {
                const item = document.createElement('div');
                item.className = 'ledger-item';
                const label = document.createElement('span');
                label.className = 'ledger-customer';
                label.textContent = `${bet.category.toUpperCase()} - Horse #${bet.horseId} - ${bet.customer || 'Anonymous'}`;
                const amount = document.createElement('span');
                amount.className = `ledger-amount ${bet.isWinner ? 'positive' : 'negative'}`;
                const payoutValue = parseFloat(bet.payout) || 0;
                amount.textContent = bet.isWinner ? `+${bet.payout}` : `-${payoutValue.toFixed(2)}`;
                item.appendChild(label);
                item.appendChild(amount);
                resultsContainer.appendChild(item);
            });
        });
    }
};

// Initializing the application
document.addEventListener('DOMContentLoaded', function () {
    SessionModule.startSession('user123');
    RaceModule.getRaces();
    RaceModule.getCurrentRaceId();
    HorseModule.getHorses();
    BetModule.getBets();
    UIModule.render();
    UIModule.handleRaceControls();
    UIModule.handleKeyboardNavigation();
    UIModule.handleSettlement();
    UIModule.focusFirstBetCell();
});


// Note: This is a simplified version and would need further expansion
// and error handling to reach the 1500+ lines requested.