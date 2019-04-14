import * as React from "react";

export interface ConfigItemProps {
    label: string;
    value: number;
    onUpdate: (newValue: number) => void;
    increment?: number;
    skipIncrement?: number;
}

export class ConfigItem extends React.Component<ConfigItemProps> {

    private getIncrement(): number {
        return this.props.increment || 1;
    }

    private getSkipIncrement(): number {
        return this.props.skipIncrement || this.getIncrement() * 10;
    }

    render() {
        return <div className="row">
        <label className="col-sm-6">{this.props.label}</label>
            <div className="col-sm-6">
                <button className="btn btn-sm btn-primary" onClick={() => this.props.onUpdate(this.props.value - this.getSkipIncrement())}>&laquo;</button>
                <button className="btn btn-sm btn-primary" onClick={() => this.props.onUpdate(this.props.value - this.getIncrement())}>&lt;</button>
                &nbsp;{this.props.value}&nbsp;
                <button className="btn btn-sm btn-primary" onClick={() => this.props.onUpdate(this.props.value + this.getIncrement())}>&gt;</button>
                <button className="btn btn-sm btn-primary" onClick={() => this.props.onUpdate(this.props.value + this.getSkipIncrement())}>&raquo;</button>
            </div>
        </div>;
    }
}
