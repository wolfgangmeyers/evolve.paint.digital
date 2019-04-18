import * as React from "react";

export interface ConfigCheckboxProps {
    label: string;
    value: boolean;
    onUpdate: (newValue: boolean) => void;
}

export class ConfigCheckbox extends React.Component<ConfigCheckboxProps> {
    render() {
        return <div className="row">
            <label className="col-sm-6">{this.props.label}</label>
            <div className="col-sm-6">
                <input
                    type="checkbox"
                    className="form-control"
                    onChange={() => this.props.onUpdate(!this.props.value)}
                    checked={this.props.value} />
            </div>
        </div>;
    }
}
